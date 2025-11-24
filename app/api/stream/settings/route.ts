
import { NextResponse } from 'next/server'
import { SupabaseStorage } from '@/lib/supabase-storage'

const storage = new SupabaseStorage()

export async function GET() {
  try {
    const settings = await storage.getStreamSettings()
    if (!settings) {
      return NextResponse.json({ message: 'Stream settings not found' }, { status: 404 })
    }
    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const settings = await storage.updateStreamSettings({ youtubeUrl: body.url })
    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
