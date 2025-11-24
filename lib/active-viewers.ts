// Shared state for tracking active viewers
export const activeViewers = new Map<string, number>()
export const VIEWER_TIMEOUT_MS = 60000 // 1 minute timeout

export function trackActiveViewer(email: string, timestamp: number) {
  activeViewers.set(email, timestamp)
}
