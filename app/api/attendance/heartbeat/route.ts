import { NextResponse } from 'next/server'
import { SupabaseStorage } from '@/lib/supabase-storage'
import { trackActiveViewer } from '@/lib/active-viewers'

const storage = new SupabaseStorage()

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, streamSessionId, name, streamTitle, startTime, durationSeconds } = body

    // Update active viewers tracking
    trackActiveViewer(email, Date.now())

    const record = await storage.upsertAttendanceRecord(email, streamSessionId, {
      name,
      streamTitle,
      startTime,
      durationSeconds,
    })

    return NextResponse.json(record)
  } catch (error) {
    console.error('Heartbeat error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}