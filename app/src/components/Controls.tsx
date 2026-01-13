/**
 * Controls.tsx
 * ------------
 * Form controls for configuring chart parameters.
 *
 * Features:
 * - Custom symbol input
 * - Interval selection
 * - History range selection
 * - Apply/Refresh actions
 */

import type { HistoryPreset } from '../types'

// ============================================================================
// TYPES
// ============================================================================

type Props = {
  /** Current value of symbol input field */
  symbolInput: string
  /** Callback when symbol input changes */
  onSymbolInputChange: (value: string) => void
  /** Form submit handler (Apply & resync) */
  onSubmit: (e: React.FormEvent) => void
  /** Callback to refresh historical data */
  onRefresh: () => void
  /** Currently selected history preset */
  historyPreset: HistoryPreset
  /** All available history presets */
  presets: HistoryPreset[]
  /** Callback when history preset changes */
  onPresetChange: (preset: HistoryPreset) => void
  /** Currently selected interval */
  interval: string
  /** All available intervals */
  intervals: { label: string; value: string }[]
  /** Callback when interval changes */
  onIntervalChange: (value: string) => void
  /** Whether data is currently loading */
  loading: boolean
}

// ============================================================================
// COMPONENT
// ============================================================================

export function Controls({
  symbolInput,
  onSymbolInputChange,
  onSubmit,
  onRefresh,
  historyPreset,
  presets,
  onPresetChange,
  interval,
  intervals,
  onIntervalChange,
  loading,
}: Props) {
  return (
    <form className="controls" onSubmit={onSubmit}>
      {/* Symbol Input */}
      <div className="field">
        <label htmlFor="symbol">Symbol</label>
        <input
          id="symbol"
          className="input"
          value={symbolInput}
          onChange={(e) => onSymbolInputChange(e.target.value.toUpperCase())}
          placeholder="e.g., BTCUSDT"
          autoComplete="off"
        />
        <span className="hint">Enter any USDⓈ-M futures pair</span>
      </div>

      {/* Interval Selector */}
      <div className="field">
        <label htmlFor="interval">Interval</label>
        <select
          id="interval"
          className="select"
          value={interval}
          onChange={(e) => onIntervalChange(e.target.value)}
        >
          {intervals.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="hint">Candle timeframe</span>
      </div>

      {/* History Range Selector */}
      <div className="field">
        <label htmlFor="history">History</label>
        <select
          id="history"
          className="select"
          value={historyPreset.label}
          onChange={(e) =>
            onPresetChange(
              presets.find((p) => p.label === e.target.value) ?? presets[0],
            )
          }
        >
          {presets.map((preset) => (
            <option key={preset.label} value={preset.label}>
              {preset.label}
            </option>
          ))}
        </select>
        <span className="hint">How far back to load</span>
      </div>

      {/* Action Buttons */}
      <div className="actions">
        <button className="button primary" type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Apply'}
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={onRefresh}
          disabled={loading}
        >
          Refresh
        </button>
      </div>
    </form>
  )
}
