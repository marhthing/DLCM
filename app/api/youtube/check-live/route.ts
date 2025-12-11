import { NextResponse } from 'next/server'
import { SupabaseStorage } from '@/lib/supabase-storage'

const storage = new SupabaseStorage()

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

export async function POST() {
  try {
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        { message: 'YouTube API key not configured' },
        { status: 500 }
      )
    }

    const settings = await storage.getStreamSettings()
    if (!settings) {
      return NextResponse.json(
        { message: 'Stream settings not found' },
        { status: 404 }
      )
    }

    if (!settings.youtubeChannelId) {
      return NextResponse.json(
        { message: 'YouTube channel ID not configured' },
        { status: 400 }
      )
    }

    const now = new Date()
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' })
    const currentTime = now.toTimeString().slice(0, 5)
    const todayDate = now.toISOString().split('T')[0]

    if (settings.lastLiveCheckDate === todayDate) {
      return NextResponse.json({
        message: 'Already checked for live stream today',
        lastCheckDate: settings.lastLiveCheckDate,
        skipped: true
      })
    }

    if (currentDay !== settings.checkDay) {
      return NextResponse.json({
        message: `Not the scheduled check day. Current: ${currentDay}, Scheduled: ${settings.checkDay}`,
        skipped: true
      })
    }

    const checkStart = settings.checkStartTime || '15:00'
    const checkEnd = settings.checkEndTime || '17:00'
    if (currentTime < checkStart || currentTime > checkEnd) {
      return NextResponse.json({
        message: `Not within check time window. Current: ${currentTime}, Window: ${settings.checkStartTime} - ${settings.checkEndTime}`,
        skipped: true
      })
    }

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${settings.youtubeChannelId}&eventType=live&type=video&key=${YOUTUBE_API_KEY}`
    
    const response = await fetch(searchUrl)
    const data = await response.json()

    if (!response.ok) {
      console.error('YouTube API error:', data)
      return NextResponse.json(
        { message: 'YouTube API error', error: data },
        { status: 500 }
      )
    }

    if (data.items && data.items.length > 0) {
      const liveVideo = data.items[0]
      const videoId = liveVideo.id.videoId
      const liveUrl = `https://www.youtube.com/embed/${videoId}`

      const autoStopAt = new Date(now.getTime() + (settings.autoAttendanceDurationHours || 4) * 60 * 60 * 1000).toISOString()

      await storage.updateStreamSettings({
        youtubeUrl: liveUrl,
        autoDetectedUrl: liveUrl,
        lastLiveCheckDate: todayDate,
      })

      await storage.toggleAttendance(true, autoStopAt)

      return NextResponse.json({
        message: 'Live stream detected!',
        videoId,
        liveUrl,
        title: liveVideo.snippet.title,
        attendanceStarted: true,
        autoStopAt,
      })
    }

    return NextResponse.json({
      message: 'No live stream found',
      channelId: settings.youtubeChannelId,
      liveDetected: false,
    })

  } catch (error) {
    console.error('Error checking YouTube live:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const settings = await storage.getStreamSettings()
    
    if (!settings) {
      return NextResponse.json({
        configured: false,
        message: 'No settings found'
      })
    }

    if (settings.attendanceAutoStopAt) {
      const autoStopTime = new Date(settings.attendanceAutoStopAt)
      const now = new Date()
      
      if (now >= autoStopTime && settings.isAttendanceActive === 'true') {
        await storage.toggleAttendance(false)
        
        return NextResponse.json({
          configured: true,
          channelId: settings.youtubeChannelId,
          checkDay: settings.checkDay,
          checkStartTime: settings.checkStartTime,
          checkEndTime: settings.checkEndTime,
          autoAttendanceDurationHours: settings.autoAttendanceDurationHours,
          lastLiveCheckDate: settings.lastLiveCheckDate,
          autoDetectedUrl: settings.autoDetectedUrl,
          attendanceStopped: true,
          message: 'Auto-stopped attendance due to duration limit'
        })
      }
    }

    return NextResponse.json({
      configured: !!settings.youtubeChannelId,
      channelId: settings.youtubeChannelId,
      checkDay: settings.checkDay,
      checkStartTime: settings.checkStartTime,
      checkEndTime: settings.checkEndTime,
      autoAttendanceDurationHours: settings.autoAttendanceDurationHours,
      lastLiveCheckDate: settings.lastLiveCheckDate,
      autoDetectedUrl: settings.autoDetectedUrl,
      attendanceAutoStopAt: settings.attendanceAutoStopAt,
    })
  } catch (error) {
    console.error('Error getting YouTube settings:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
