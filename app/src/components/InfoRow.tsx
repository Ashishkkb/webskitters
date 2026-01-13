/**
 * InfoRow.tsx
 * -----------
 * Displays information pills below the controls.
 *
 * Shows:
 * - History range summary
 * - Date coverage of loaded data
 * - Last update time
 * - Warning when range is capped
 * - Error messages (if any)
 */

// ============================================================================
// TYPES
// ============================================================================

type Props = {
  /** Description of selected history range */
  historyLabel: string
  /** Date range covered by candle data */
  coverageLabel: string
  /** Time since last data update */
  lastUpdateLabel: string
  /** Error message to display (if any) */
  error: string | null
  /** Warning message (e.g., when range is capped) */
  warning?: string | null
}

// ============================================================================
// COMPONENT
// ============================================================================

export function InfoRow({
  historyLabel,
  coverageLabel,
  lastUpdateLabel,
  error,
  warning,
}: Props) {
  return (
    <>
      {/* Info Pills */}
      <div className="info-row">
        <span className="pill">
          <strong>Range:</strong> {historyLabel}
        </span>
        <span className="pill">
          <strong>Coverage:</strong> {coverageLabel}
        </span>
        <span className="pill">
          <strong>Updated:</strong> {lastUpdateLabel}
        </span>
      </div>

      {/* Warning Message (e.g., capped range) */}
      {warning && <div className="warning">⚠️ {warning}</div>}

      {/* Error Message */}
      {error && <div className="error">❌ {error}</div>}
    </>
  )
}
