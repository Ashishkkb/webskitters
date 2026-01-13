/**
 * App.tsx
 * -------
 * Main application component for the Live Binance Candlestick Chart.
 *
 * Architecture:
 * - Left sidebar: Symbol selection list
 * - Right main area: Chart controls, price chart, and status info
 *
 * Data flow:
 * 1. User selects symbol/interval/history range
 * 2. useKlines hook fetches historical data and connects WebSocket
 * 3. PriceChart renders candlesticks and updates in real-time
 */

import { useMemo, useState } from 'react'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { Controls } from './components/Controls'
import { InfoRow } from './components/InfoRow'
import { PriceChart } from './components/PriceChart'
import { SymbolList } from './components/SymbolList'
import { StatusBar } from './components/StatusBar'
import { useKlines } from './hooks/useKlines'
import { MAX_CANDLES_CAP, isPresetCapped, actualCoverageDays, intervalToMinutes } from './services/binance'
import type { HistoryPreset } from './types'
import './App.css'

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Default trading pair on initial load */
const DEFAULT_SYMBOL = 'BTCUSDT'

/** Default candle interval on initial load */
const DEFAULT_INTERVAL = '1m'

/**
 * Available kline intervals.
 * Each interval determines candle granularity.
 */
const INTERVALS = [
  { label: '1 minute', value: '1m' },
  { label: '5 minutes', value: '5m' },
  { label: '15 minutes', value: '15m' },
  { label: '1 hour', value: '1h' },
]

/**
 * History range presets.
 * Determines how far back to fetch historical data.
 * Note: Longer ranges require more API calls (1500 candles per request max).
 */
const HISTORY_PRESETS: HistoryPreset[] = [
  { label: 'Last 500 candles (~8h)', minutes: 500 }, // Default: matches spec (1m, 500 candles)
  { label: 'Last 1 day', minutes: 24 * 60 },
  { label: 'Last 7 days', minutes: 7 * 24 * 60 },
  { label: 'Last 30 days', minutes: 30 * 24 * 60 },
  { label: 'Last 90 days', minutes: 90 * 24 * 60 },
  { label: 'Last 180 days', minutes: 180 * 24 * 60 },
  { label: 'Last 365 days', minutes: 365 * 24 * 60 },
  { label: 'Max available', minutes: Infinity },
]

/**
 * Available trading symbols.
 * Reduced to 3 major pairs for cleaner UX and reliable data.
 */
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function App() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Input field value (may differ from active symbol during typing) */
  const [symbolInput, setSymbolInput] = useState(DEFAULT_SYMBOL)

  /** Currently active symbol being displayed */
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL)

  /** Currently active candle interval */
  const [interval, setInterval] = useState(DEFAULT_INTERVAL)

  /** Currently selected history range */
  const [historyPreset, setHistoryPreset] = useState<HistoryPreset>(
    HISTORY_PRESETS[0], // Default: Last 500 candles (~8h)
  )

  // ---------------------------------------------------------------------------
  // Data Hook
  // ---------------------------------------------------------------------------

  /**
   * useKlines manages all data fetching and WebSocket streaming.
   * Re-runs when symbol, interval, or historyPreset changes.
   */
  const {
    candles,
    historyLoading,
    error,
    connection,
    nextRetrySec,
    lastUpdated,
    refreshHistory,
  } = useKlines({ symbol, interval, historyPreset })

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  /** Human-readable connection status */
  const connectionLabel = useMemo(() => {
    switch (connection) {
      case 'online':
        return 'Live: streaming'
      case 'connecting':
        return 'Connecting to Binance…'
      case 'offline':
        return nextRetrySec
          ? `Reconnecting in ${nextRetrySec}s`
          : 'Disconnected'
      case 'error':
        return 'Connection error'
      default:
        return 'Idle'
    }
  }, [connection, nextRetrySec])

  /** Date range covered by current candle data */
  const coverageLabel = useMemo(() => {
    if (candles.length < 2) return 'Waiting for data'
    const first = new Date(Number(candles[0].time) * 1000)
    const last = new Date(Number(candles[candles.length - 1].time) * 1000)
    return `${format(first, 'MMM d, HH:mm')} → ${format(last, 'MMM d, HH:mm')}`
  }, [candles])

  /** Check if the current preset/interval combo will be capped */
  const isCapped = useMemo(
    () => isPresetCapped(historyPreset, interval),
    [historyPreset, interval],
  )

  /** Calculate actual coverage in days when capped */
  const actualDays = useMemo(
    () => actualCoverageDays(historyPreset, interval),
    [historyPreset, interval],
  )

  /** Human-readable history depth description */
  const depthLabel = useMemo(() => {
    if (!isFinite(historyPreset.minutes)) {
      return `Max (~${MAX_CANDLES_CAP.toLocaleString()} candles)`
    }
    
    // If capped, show actual coverage instead of requested
    if (isCapped) {
      return `~${actualDays.toFixed(1)} days (capped)`
    }
    
    const minutes = historyPreset.minutes
    if (minutes < 180) return `~${minutes} minutes`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `~${hours} hours`
    const days = (hours / 24).toFixed(1).replace(/\.0$/, '')
    return `~${days} days`
  }, [historyPreset, isCapped, actualDays])

  /** Warning message when range is capped */
  const cappedWarning = useMemo(() => {
    if (!isCapped) return null
    const requestedDays = historyPreset.minutes / (60 * 24)
    const intervalLabel = intervalToMinutes[interval] === 1 ? '1-minute' : 
                          intervalToMinutes[interval] === 5 ? '5-minute' :
                          intervalToMinutes[interval] === 15 ? '15-minute' : '1-hour'
    return `${intervalLabel} candles limited to ~${actualDays.toFixed(1)} days (${MAX_CANDLES_CAP.toLocaleString()} candles max). Use a larger interval for ${requestedDays.toFixed(0)}-day range.`
  }, [isCapped, historyPreset, interval, actualDays])

  const candlesCount = candles.length
  const historyLabel = `${historyPreset.label} (${depthLabel})`
  const lastUpdateLabel = lastUpdated
    ? `${formatDistanceToNowStrict(lastUpdated, { addSuffix: true })}`
    : 'Waiting for data'

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  /** Handles form submission (Apply & resync button) */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = symbolInput.trim().toUpperCase()
    if (!cleaned) return
    if (cleaned === symbol) {
      // Same symbol: force a manual resync so Apply is not a no-op
      refreshHistory()
    } else {
      // Different symbol: update state; useKlines effect will fetch and reconnect
      setSymbol(cleaned)
    }
  }

  /** Handles symbol selection from sidebar list */
  const selectSymbol = (next: string) => {
    const value = next.toUpperCase()
    setSymbolInput(value)
    setSymbol(value)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="app-shell">
      <div className="dashboard">
        {/* Left Sidebar: Symbol List */}
        <SymbolList
          symbols={SYMBOLS}
          selected={symbol}
          onSelect={selectSymbol}
        />

        {/* Right Main Area */}
        <div className="main">
          {/* Header with Title and Status */}
          <header className="header">
            <div className="title-block">
              <h1>
                <span className="symbol-badge">{symbol}</span>
                Live Candlesticks
              </h1>
              <p>
                Real-time USDⓈ-M Futures data via Binance REST + WebSocket
              </p>
              <StatusBar
                connection={connection}
                connectionLabel={connectionLabel}
                candlesCount={candlesCount}
              />
            </div>
          </header>

          {/* Controls Card */}
          <div className="card controls-card">
            <Controls
              symbolInput={symbolInput}
              onSymbolInputChange={setSymbolInput}
              onSubmit={handleSubmit}
              onRefresh={refreshHistory}
              historyPreset={historyPreset}
              presets={HISTORY_PRESETS}
              onPresetChange={setHistoryPreset}
              interval={interval}
              intervals={INTERVALS}
              onIntervalChange={setInterval}
              loading={historyLoading}
            />
            <InfoRow
              historyLabel={historyLabel}
              coverageLabel={coverageLabel}
              lastUpdateLabel={lastUpdateLabel}
              error={error}
              warning={cappedWarning}
            />
          </div>

          {/* Chart Card */}
          <div className="card chart-card">
            {historyLoading && (
              <div className="chart-overlay">
                <div className="loader" />
                <span>Loading {symbol} data…</span>
              </div>
            )}
            {/* Pass symbol to PriceChart so it can detect symbol changes */}
            <PriceChart candles={candles} symbol={symbol} />
          </div>

        </div>
      </div>
    </div>
  )
}

export default App
