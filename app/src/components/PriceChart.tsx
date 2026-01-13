/**
 * PriceChart.tsx
 * --------------
 * Renders a TradingView Lightweight Chart with candlestick data.
 *
 * Key features:
 * - Creates chart once on mount, updates data incrementally
 * - Detects dataset resets (symbol/range changes) vs live updates
 * - Auto-resizes with container
 * - Uses setData() for resets, update() for live ticks (performance)
 */

import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
} from 'lightweight-charts'

// ============================================================================
// TYPES
// ============================================================================

type Props = {
  /** Array of candlestick data to display */
  candles: CandlestickData[]
  /** Current symbol - used to detect symbol changes */
  symbol: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PriceChart({ candles, symbol }: Props) {
  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)
  const seriesRef = useRef<
    ReturnType<ReturnType<typeof createChart>['addSeries']> | null
  >(null)

  // Tracking refs for detecting resets vs incremental updates
  const hydratedRef = useRef(false)
  const prevSymbolRef = useRef<string | null>(null)
  const prevLengthRef = useRef(0)
  const prevFirstTimeRef = useRef<number | null>(null)
  const prevLastTimeRef = useRef<number | null>(null)

  // ---------------------------------------------------------------------------
  // Chart Initialization (runs once on mount)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return

    // Create the chart with dark theme styling
    const chart = createChart(containerRef.current, {
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
        fontFamily:
          "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.15)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.15)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: CrosshairMode.Normal },
    })

    // Add candlestick series with green/red colors
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      })
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    chartRef.current = chart
    seriesRef.current = series

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Symbol Change Effect - Clear chart immediately when symbol changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!seriesRef.current) return
    
    // If symbol changed, immediately clear the chart to prevent stale data display
    if (prevSymbolRef.current !== null && prevSymbolRef.current !== symbol) {
      seriesRef.current.setData([])
      hydratedRef.current = false
      prevLengthRef.current = 0
      prevFirstTimeRef.current = null
      prevLastTimeRef.current = null
    }
    prevSymbolRef.current = symbol
  }, [symbol])

  // ---------------------------------------------------------------------------
  // Data Update Effect (runs when candles change)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return

    const first = candles[0]
    const last = candles[candles.length - 1]

    const firstTime = Number(first.time)
    const lastTime = Number(last.time)
    const prevLen = prevLengthRef.current
    const prevFirstTime = prevFirstTimeRef.current
    const prevLastTime = prevLastTimeRef.current

    /**
     * Determine if this is a "reset" (need setData) vs "update" (incremental).
     *
     * Reset conditions:
     * - First hydration (after symbol change or initial load)
     * - First candle time changed (history range shift)
     * - Time went backwards (new dataset with older data)
     * - Large shrink in length (data was trimmed significantly)
     * - Large jump in length (batch history load)
     */
    const isReset =
      !hydratedRef.current ||
      prevLen === 0 ||
      prevFirstTime === null ||
      prevLastTime === null ||
      firstTime !== prevFirstTime ||
      lastTime < prevLastTime ||
      candles.length < prevLen - 1 ||
      candles.length - prevLen > 1

    if (isReset) {
      // Full data replacement
      seriesRef.current.setData(candles)
      chartRef.current?.timeScale().fitContent()
      hydratedRef.current = true
    } else {
      // Incremental update: either forming candle update or append
      seriesRef.current.update(last)
    }

    // Update tracking refs for next comparison
    prevLengthRef.current = candles.length
    prevFirstTimeRef.current = firstTime
    prevLastTimeRef.current = lastTime
  }, [candles])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return <div ref={containerRef} className="chart-container" />
}
