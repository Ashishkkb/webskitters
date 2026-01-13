/**
 * types.ts
 * --------
 * Shared TypeScript types used across the application.
 * Keeping types in a central file improves maintainability.
 */

/**
 * Represents the WebSocket connection state.
 * - idle: Initial state before any connection attempt
 * - connecting: Attempting to establish connection
 * - online: WebSocket is connected and streaming
 * - offline: Disconnected, waiting for reconnect
 * - error: Connection error occurred
 */
export type ConnectionState = 'idle' | 'connecting' | 'online' | 'offline' | 'error'

/**
 * Configuration for how much historical data to fetch.
 * - label: Human-readable description shown in UI
 * - minutes: Time range in minutes (Infinity = fetch all available)
 */
export type HistoryPreset = {
  label: string
  minutes: number
}
