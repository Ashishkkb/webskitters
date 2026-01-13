/**
 * SymbolList.tsx
 * --------------
 * Sidebar component for selecting trading pairs.
 *
 * Features:
 * - Search/filter functionality
 * - Highlights active symbol
 * - Click to instantly switch
 */

import { useState } from 'react'

// ============================================================================
// TYPES
// ============================================================================

type Props = {
  /** Available trading pair symbols */
  symbols: string[]
  /** Currently selected symbol */
  selected: string
  /** Callback when user selects a symbol */
  onSelect: (symbol: string) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SymbolList({ symbols, selected, onSelect }: Props) {
  /** Search input value for filtering symbols */
  const [search, setSearch] = useState('')

  // Filter symbols based on search input
  const filtered = symbols.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <aside className="sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <h2>Markets</h2>
        <span className="sidebar-subtitle">USDⓈ-M Futures</span>
      </div>

      {/* Search Input */}
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search symbols…"
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Symbol List */}
      <ul className="symbol-list">
        {filtered.map((sym) => (
          <li key={sym}>
            <button
              type="button"
              className={`symbol-item ${selected === sym ? 'active' : ''}`}
              onClick={() => onSelect(sym)}
            >
              <span className="symbol-name">{sym}</span>
              <span className="symbol-arrow">→</span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="no-results">No symbols found</li>
        )}
      </ul>
    </aside>
  )
}
