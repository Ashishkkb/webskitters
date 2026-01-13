/**
 * StatusBar.tsx
 * -------------
 * Displays connection status and candle count badges.
 *
 * Visual indicators:
 * - Green dot: Connected and streaming
 * - Yellow dot: Connecting
 * - Red dot: Offline or error
 */

import type { ConnectionState } from '../types'

// ============================================================================
// TYPES
// ============================================================================

type Props = {
  /** Current WebSocket connection state */
  connection: ConnectionState
  /** Human-readable connection status text */
  connectionLabel: string
  /** Number of candles currently in memory */
  candlesCount: number
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StatusBar({
  connection,
  connectionLabel,
  candlesCount,
}: Props) {
  return (
    <div className="status-row">
      {/* Connection Status Badge */}
      <span className={`badge ${connection}`}>
        <span className="dot" />
        {connectionLabel}
      </span>

      {/* Candles Count Badge */}
      <span className="badge info">
        <span className="dot" />
        {candlesCount.toLocaleString()} candles
      </span>
    </div>
  )
}
