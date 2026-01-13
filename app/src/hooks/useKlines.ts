/**
 * useKlines.ts
 * ------------
 * Custom React hook for managing candlestick data lifecycle.
 *
 * Responsibilities:
 * 1. Fetch historical klines via REST API on mount and config changes
 * 2. Subscribe to WebSocket for live candle updates
 * 3. Handle reconnection with exponential backoff
 * 4. Merge incoming candles (forming vs closed) without duplicates
 * 5. Cancel stale requests when config changes mid-flight
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CandlestickData } from 'lightweight-charts'
import {
  buildWsUrl,
  fetchHistorical,
  maxCandlesForPreset,
  toCandle,
} from '../services/binance'
import type { ConnectionState, HistoryPreset } from '../types'

// ============================================================================
// TYPES
// ============================================================================

type UseKlinesArgs = {
  /** Trading pair symbol (e.g., 'BTCUSDT') */
  symbol: string
  /** Kline interval (e.g., '1m', '1h') */
  interval: string
  /** How much historical data to fetch */
  historyPreset: HistoryPreset
}

type UseKlinesReturn = {
  /** Array of candlestick data for the chart */
  candles: CandlestickData[]
  /** True while fetching historical data */
  historyLoading: boolean
  /** Error message if something failed */
  error: string | null
  /** Current WebSocket connection state */
  connection: ConnectionState
  /** Seconds until next reconnection attempt (if offline) */
  nextRetrySec: number | null
  /** Timestamp of last data update */
  lastUpdated: Date | null
  /** Function to manually refresh historical data */
  refreshHistory: () => void
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export const useKlines = ({
  symbol,
  interval,
  historyPreset,
}: UseKlinesArgs): UseKlinesReturn => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [candles, setCandles] = useState<CandlestickData[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('idle')
  const [nextRetrySec, setNextRetrySec] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // ---------------------------------------------------------------------------
  // Refs (persist across renders without triggering re-renders)
  // ---------------------------------------------------------------------------
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const historyAbortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0) // Tracks latest request to ignore stale responses

  // ---------------------------------------------------------------------------
  // Derived Values
  // ---------------------------------------------------------------------------
  /** Maximum candles to keep in memory (prevents unbounded growth) */
  const cap = useMemo(
    () => maxCandlesForPreset(historyPreset, interval),
    [historyPreset, interval],
  )

  // ---------------------------------------------------------------------------
  // Candle Merge Logic
  // ---------------------------------------------------------------------------
  /**
   * Applies an incoming candle from WebSocket to the local state.
   *
   * Merge semantics:
   * - If candle.time > last.time: New candle, append to array (trim to cap)
   * - If candle.time === last.time: Update forming candle (OHLC changed)
   * - If candle.time < last.time: Ignore (stale/out-of-order)
   */
  const applyIncomingCandle = useCallback(
    (candle: CandlestickData) => {
      setCandles((prev) => {
        const last = prev[prev.length - 1]

        if (!last || candle.time > last.time) {
          // New candle: append and trim oldest if over cap
          return [...prev, candle].slice(-cap)
        }

        if (last.time === candle.time) {
          // Forming candle update: replace last with updated values
          return [...prev.slice(0, -1), candle]
        }

        // Stale candle: ignore
        return prev
      })
    },
    [cap],
  )

  // ---------------------------------------------------------------------------
  // History Fetching
  // ---------------------------------------------------------------------------
  /**
   * Fetches historical kline data from Binance REST API.
   *
   * Features:
   * - Aborts previous in-flight request (prevents race conditions)
   * - Ignores responses from stale requests
   * - Updates loading/error state appropriately
   */
  const loadHistory = useCallback(
    async (sym: string, intv: string, preset: HistoryPreset) => {
      // Increment request ID and abort any in-flight request
      requestIdRef.current += 1
      const requestId = requestIdRef.current
      historyAbortRef.current?.abort()
      const controller = new AbortController()
      historyAbortRef.current = controller

      setHistoryLoading(true)
      setError(null)

      try {
        const candlesLoaded = await fetchHistorical(
          sym,
          intv,
          preset,
          controller.signal,
        )

        // Ignore if a newer request has been initiated
        if (requestId !== requestIdRef.current) return

        setCandles(candlesLoaded)
        setLastUpdated(new Date())
      } catch (err) {
        // Ignore abort errors (expected when switching config)
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setError(
          err instanceof Error ? err.message : 'Failed to load historical data',
        )
      } finally {
        // Only update loading state if this is still the active request
        if (requestId !== requestIdRef.current) return
        setHistoryLoading(false)
      }
    },
    [],
  )

  /** Manual refresh handler exposed to UI */
  const refreshHistory = useCallback(
    () => loadHistory(symbol, interval, historyPreset),
    [historyPreset, interval, loadHistory, symbol],
  )

  // ---------------------------------------------------------------------------
  // Bootstrap & WebSocket Effect
  // ---------------------------------------------------------------------------
  /**
   * Main effect: runs on mount and whenever symbol/interval/preset changes.
   *
   * Flow:
   * 1. Cleanup previous WebSocket and pending requests
   * 2. Fetch historical data via REST
   * 3. Connect to WebSocket for live updates
   * 4. Handle reconnection with exponential backoff on disconnect
   */
  useEffect(() => {
    let cancelled = false
    let attempts = 0

    /**
     * Cleans up WebSocket, timers, and aborts pending requests.
     * Called on effect cleanup and before establishing new connections.
     */
    const cleanup = () => {
      historyAbortRef.current?.abort()
      historyAbortRef.current = null

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      if (wsRef.current) {
        // Remove handlers before closing to prevent spurious events
        wsRef.current.onopen = null
        wsRef.current.onmessage = null
        wsRef.current.onerror = null
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }

    /**
     * Schedules a reconnection attempt with exponential backoff.
     * Delay: 2s, 4s, 8s, 16s, 32s (capped at 30s)
     */
    const scheduleReconnect = () => {
      if (cancelled) return
      attempts += 1
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts, 5))
      setConnection('offline')
      setNextRetrySec(Math.round(delay / 1000))
      reconnectTimerRef.current = setTimeout(connect, delay)
    }

    /**
     * Establishes WebSocket connection and sets up event handlers.
     */
    const connect = () => {
      if (cancelled) return

      const ws = new WebSocket(buildWsUrl(symbol, interval))
      wsRef.current = ws
      setConnection('connecting')

      ws.onopen = () => {
        if (cancelled) return
        attempts = 0 // Reset backoff on successful connection
        setConnection('online')
        setNextRetrySec(null)
      }

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          const k = payload?.k
          if (!k) return

          // Convert WebSocket kline format to our candle format
          const candle = toCandle([k.t, k.o, k.h, k.l, k.c])
          applyIncomingCandle(candle)

          // Update timestamp when candle closes (k.x = is closed)
          if (k.x) setLastUpdated(new Date())
        } catch (err) {
          console.error('Failed to parse kline message', err)
        }
      }

      ws.onerror = () => {
        setConnection('error')
        ws.close()
      }

      ws.onclose = () => {
        scheduleReconnect()
      }
    }

    /**
     * Bootstrap sequence: fetch history, then connect WebSocket.
     * CRITICAL: Clear candles first to prevent mixing data from different symbols!
     */
    const bootstrap = async () => {
      cleanup()
      setCandles([]) // Clear old data immediately before loading new symbol!
      setConnection('connecting')
      await loadHistory(symbol, interval, historyPreset)
      if (!cancelled) connect()
    }

    bootstrap()

    // Cleanup on unmount or when dependencies change
    return () => {
      cancelled = true
      cleanup()
      setNextRetrySec(null)
    }
  }, [applyIncomingCandle, historyPreset, interval, loadHistory, symbol])

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    candles,
    historyLoading,
    error,
    connection,
    nextRetrySec,
    lastUpdated,
    refreshHistory,
  }
}
