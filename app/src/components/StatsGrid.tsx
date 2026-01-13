/**
 * StatsGrid.tsx
 * -------------
 * Displays key features/stats as a grid of cards.
 *
 * Highlights:
 * - Data correctness guarantees
 * - Resiliency features
 * - State safety
 * - How to run
 */

// ============================================================================
// COMPONENT
// ============================================================================

export function StatsGrid() {
  return (
    <div className="grid">
      <div className="stat">
        <span className="stat-icon">✓</span>
        <div className="stat-content">
          <span className="stat-label">Correctness</span>
          <strong className="stat-value">Merge + no duplicates</strong>
        </div>
      </div>

      <div className="stat">
        <span className="stat-icon">↻</span>
        <div className="stat-content">
          <span className="stat-label">Resiliency</span>
          <strong className="stat-value">Auto reconnect</strong>
        </div>
      </div>

      <div className="stat">
        <span className="stat-icon">◉</span>
        <div className="stat-content">
          <span className="stat-label">State Safety</span>
          <strong className="stat-value">Cached on reconnect</strong>
        </div>
      </div>

      <div className="stat">
        <span className="stat-icon">▶</span>
        <div className="stat-content">
          <span className="stat-label">Run</span>
          <strong className="stat-value">npm install → npm run dev</strong>
        </div>
      </div>
    </div>
  )
}
