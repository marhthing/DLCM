import { NextResponse } from 'next/server'
import { SupabaseStorage } from '@/lib/supabase-storage'

const storage = new SupabaseStorage()
const VIEWER_TIMEOUT_MS = 120000 // 2 minute timeout

export async function GET() {
  try {
    const count = await storage.getActiveViewersCount(VIEWER_TIMEOUT_MS)
    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error getting active viewers:', error)
    return NextResponse.json({ count: 0 }, { status: 200 })
  }
}
