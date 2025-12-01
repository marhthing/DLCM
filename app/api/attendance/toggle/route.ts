
import { NextResponse } from 'next/server'
import { SupabaseStorage } from '@/lib/supabase-storage'

const storage = new SupabaseStorage()

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { isActive } = body
    
    const settings = await storage.toggleAttendance(isActive)
    
    if (!settings) {
      return NextResponse.json({ message: 'Failed to toggle attendance' }, { status: 500 })
    }
    
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Toggle attendance error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
