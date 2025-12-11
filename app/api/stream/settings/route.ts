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
    
    const updateData: any = {}
    
    if (body.url !== undefined) updateData.youtubeUrl = body.url
    if (body.youtubeUrl !== undefined) updateData.youtubeUrl = body.youtubeUrl
    if (body.youtubeChannelId !== undefined) updateData.youtubeChannelId = body.youtubeChannelId
    if (body.checkDay !== undefined) updateData.checkDay = body.checkDay
    if (body.checkStartTime !== undefined) updateData.checkStartTime = body.checkStartTime
    if (body.checkEndTime !== undefined) updateData.checkEndTime = body.checkEndTime
    if (body.autoAttendanceDurationHours !== undefined) updateData.autoAttendanceDurationHours = body.autoAttendanceDurationHours
    if (body.lastLiveCheckDate !== undefined) updateData.lastLiveCheckDate = body.lastLiveCheckDate
    if (body.autoDetectedUrl !== undefined) updateData.autoDetectedUrl = body.autoDetectedUrl
    if (body.attendanceAutoStopAt !== undefined) updateData.attendanceAutoStopAt = body.attendanceAutoStopAt
    
    const settings = await storage.updateStreamSettings(updateData)
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error updating stream settings:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}