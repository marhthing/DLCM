// Shared state for tracking active viewers
export const activeViewers = new Map<string, number>()
export const VIEWER_TIMEOUT_MS = 120000 // 2 minute timeout (heartbeat is 30s, so this allows 4 missed heartbeats)

export function trackActiveViewer(email: string, timestamp: number) {
  activeViewers.set(email, timestamp)
}
