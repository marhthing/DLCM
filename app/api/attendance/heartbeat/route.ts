import { NextResponse } from 'next/server'
import { SupabaseStorage } from '@/lib/supabase-storage'

const storage = new SupabaseStorage()

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, streamSessionId, name, branch, streamTitle, startTime, durationSeconds } = body

    // Upsert attendance record - this updates last_seen_at in the database
    const record = await storage.upsertAttendanceRecord(email, streamSessionId, {
      name,
      branch: branch || 'Pontypridd',
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
