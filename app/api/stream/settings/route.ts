import { NextResponse } from 'next/server'
import { SupabaseStorage } from '@/lib/supabase-storage'

const storage = new SupabaseStorage()

export async function GET() {
  try {
    const settings = await storage.getStreamSettings()
    if (!settings) {
      // Return default settings instead of 404
      return NextResponse.json({
        id: '',
        youtubeUrl: '',
        isAttendanceActive: 'false',
        updatedAt: new Date().toISOString(),
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }
    return NextResponse.json(settings, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error fetching stream settings:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
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