/**
 * binance.ts
 * ----------
 * Service layer for Binance USDⓈ-M Futures API.
 * Handles REST API calls for historical klines and WebSocket URL construction.
 *
 * API Documentation:
 * https://developers.binance.com/docs/derivatives/usds-margined-futures/general-info
 */

import type { CandlestickData, UTCTimestamp } from 'lightweight-charts'
import type { HistoryPreset } from '../types'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Base URL for Binance Futures REST API (klines endpoint) */
export const REST_BASE = 'https://fapi.binance.com/fapi/v1/klines'

/** Base URL for Binance Futures WebSocket stream */
export const WS_BASE = 'wss://fstream.binance.com/ws'

/** Maximum candles Binance returns per single REST request */
export const MAX_PER_REQUEST = 1500

/**
 * Safety cap to prevent fetching too much data (memory/performance).
 * 
 * Coverage at different intervals:
 * - 1m:  50,000 candles = ~34.7 days
 * - 5m:  50,000 candles = ~173 days  
 * - 15m: 50,000 candles = ~520 days
 * - 1h:  50,000 candles = ~5.7 years
 */
export const MAX_CANDLES_CAP = 50000

/**
 * Mapping of interval strings to their duration in minutes.
 * Used to calculate how many candles are needed for a time range.
 */
export const intervalToMinutes: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
}

// ============================================================================
// URL BUILDERS
// ============================================================================

/**
 * Constructs the REST API URL for fetching kline/candlestick data.
 *
 * @param symbol - Trading pair (e.g., 'BTCUSDT')
 * @param interval - Kline interval (e.g., '1m', '1h')
 * @param limit - Number of candles to fetch (max 1500)
 * @param endTime - Optional end timestamp for pagination (ms since epoch)
 * @returns Complete REST API URL
 */
export const buildRestUrl = (
  symbol: string,
  interval: string,
  limit: number,
  endTime?: number,
): string => {
  const params = new URLSearchParams({
    symbol,
    interval,
    limit: String(limit),
  })
  if (endTime) params.append('endTime', String(endTime))
  return `${REST_BASE}?${params.toString()}`
}

/**
 * Constructs the WebSocket URL for subscribing to live kline updates.
 *
 * @param symbol - Trading pair (lowercase in URL, e.g., 'btcusdt')
 * @param interval - Kline interval (e.g., '1m', '1h')
 * @returns WebSocket stream URL
 */
export const buildWsUrl = (symbol: string, interval: string): string =>
  `${WS_BASE}/${symbol.toLowerCase()}@kline_${interval}`

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Converts raw Binance kline array to TradingView CandlestickData format.
 *
 * Binance kline format: [openTime, open, high, low, close, volume, ...]
 * TradingView format: { time, open, high, low, close }
 *
 * @param row - Raw kline array from Binance API
 * @returns Formatted candlestick data for TradingView
 */
export const toCandle = (row: any[]): CandlestickData => ({
  time: (row[0] / 1000) as UTCTimestamp, // Convert ms to seconds
  open: parseFloat(row[1]),
  high: parseFloat(row[2]),
  low: parseFloat(row[3]),
  close: parseFloat(row[4]),
})

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

/**
 * Calculates the maximum number of candles needed for a given history preset.
 *
 * @param preset - History range configuration
 * @param interval - Kline interval (affects candle density)
 * @returns Number of candles to fetch (capped at MAX_CANDLES_CAP)
 */
export const maxCandlesForPreset = (preset: HistoryPreset, interval: string): number => {
  const minutes = intervalToMinutes[interval] ?? 1
  if (!isFinite(preset.minutes)) return MAX_CANDLES_CAP
  const needed = Math.ceil(preset.minutes / minutes)
  return Math.min(needed, MAX_CANDLES_CAP)
}

/**
 * Calculates how many candles would be needed for the full preset (uncapped).
 */
export const candlesNeededForPreset = (preset: HistoryPreset, interval: string): number => {
  const minutes = intervalToMinutes[interval] ?? 1
  if (!isFinite(preset.minutes)) return Infinity
  return Math.ceil(preset.minutes / minutes)
}

/**
 * Checks if the requested range will be capped.
 */
export const isPresetCapped = (preset: HistoryPreset, interval: string): boolean => {
  const needed = candlesNeededForPreset(preset, interval)
  return needed > MAX_CANDLES_CAP
}

/**
 * Calculates the actual time coverage when capped (in days).
 */
export const actualCoverageDays = (preset: HistoryPreset, interval: string): number => {
  const minutes = intervalToMinutes[interval] ?? 1
  const candles = maxCandlesForPreset(preset, interval)
  return (candles * minutes) / (60 * 24)
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches historical kline data with automatic pagination.
 *
 * Since Binance limits each request to 1500 candles, this function
 * makes multiple requests (walking backwards in time) until:
 * - We have enough candles for the requested preset
 * - We've reached the start of available data
 * - We've hit the safety cap
 *
 * @param sym - Trading pair symbol
 * @param intv - Kline interval
 * @param preset - History range configuration
 * @param signal - AbortController signal for cancellation
 * @returns Array of candlestick data, sorted oldest-to-newest
 * @throws Error if API request fails (non-abort errors)
 */
export const fetchHistorical = async (
  sym: string,
  intv: string,
  preset: HistoryPreset,
  signal?: AbortSignal,
): Promise<CandlestickData[]> => {
  const targetCandles = maxCandlesForPreset(preset, intv)

  // Calculate the earliest timestamp we want (if preset has finite range)
  const targetStartMs = isFinite(preset.minutes)
    ? Date.now() - preset.minutes * 60 * 1000
    : null

  let endTime: number | undefined = Date.now()
  const collected: CandlestickData[] = []

  // Pagination loop: fetch chunks walking backwards in time
  while (collected.length < targetCandles) {
    const remaining = targetCandles - collected.length
    const limit = Math.min(MAX_PER_REQUEST, remaining)

    const res = await fetch(buildRestUrl(sym, intv, limit, endTime), { signal })
    if (!res.ok) throw new Error(`Unable to fetch history (${res.status})`)

    const payload = (await res.json()) as any[]
    if (!payload.length) break // No more data available

    const chunk = payload.map((row) => toCandle(row))
    collected.push(...chunk)

    // Move endTime to just before the oldest candle in this chunk
    const firstOpen = payload[0][0] as number
    endTime = firstOpen - 1

    // Stop if we've reached our target start time
    if (targetStartMs && firstOpen <= targetStartMs) break

    // Stop if we got fewer candles than requested (no more data)
    if (chunk.length < limit) break
  }

  // Sort chronologically (oldest first) for TradingView
  return collected.sort((a, b) => Number(a.time) - Number(b.time))
}
