import { NextResponse } from 'next/server'
import { activeViewers, VIEWER_TIMEOUT_MS } from '@/lib/active-viewers'

export async function GET() {
  try {
    const now = Date.now()
    // Remove stale viewers (no heartbeat in last minute)
    for (const [email, lastSeen] of activeViewers.entries()) {
      if (now - lastSeen > VIEWER_TIMEOUT_MS) {
        activeViewers.delete(email)
      }
    }
    
    return NextResponse.json({ count: activeViewers.size })
  } catch (error) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
