import { NextResponse } from 'next/server'
import { SupabaseStorage } from '@/lib/supabase-storage'

const storage = new SupabaseStorage()
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

export async function GET() {
  try {
    const settings = await storage.getStreamSettings()
    
    if (!settings) {
      return NextResponse.json({ message: 'No settings found', action: 'none' })
    }

    if (settings.attendanceAutoStopAt && settings.isAttendanceActive === 'true') {
      const autoStopTime = new Date(settings.attendanceAutoStopAt)
      const now = new Date()
      
      if (now >= autoStopTime) {
        await storage.toggleAttendance(false)
        return NextResponse.json({
          message: 'Auto-stopped attendance due to duration limit',
          action: 'attendance_stopped'
        })
      }
    }

    if (!YOUTUBE_API_KEY) {
      return NextResponse.json({ message: 'YouTube API key not configured', action: 'none' })
    }

    if (!settings.youtubeChannelId) {
      return NextResponse.json({ message: 'Channel ID not configured', action: 'none' })
    }

    const now = new Date()
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' })
    const currentTime = now.toTimeString().slice(0, 5)
    const todayDate = now.toISOString().split('T')[0]

    if (settings.lastLiveCheckDate === todayDate) {
      return NextResponse.json({
        message: 'Already found live stream today',
        action: 'skipped',
        lastCheckDate: settings.lastLiveCheckDate
      })
    }

    if (currentDay !== settings.checkDay) {
      return NextResponse.json({
        message: `Not scheduled day. Current: ${currentDay}, Scheduled: ${settings.checkDay}`,
        action: 'skipped'
      })
    }

    const checkStart = settings.checkStartTime || '15:00'
    const checkEnd = settings.checkEndTime || '17:00'
    if (currentTime < checkStart || currentTime > checkEnd) {
      return NextResponse.json({
        message: `Outside check window. Current: ${currentTime}, Window: ${checkStart} - ${checkEnd}`,
        action: 'skipped'
      })
    }

    const checkIntervalMs = (settings.checkIntervalMinutes || 5) * 60 * 1000
    if (settings.lastApiCheckTime) {
      const lastCheck = new Date(settings.lastApiCheckTime)
      const timeSinceLastCheck = now.getTime() - lastCheck.getTime()
      
      if (timeSinceLastCheck < checkIntervalMs) {
        const nextCheckIn = Math.ceil((checkIntervalMs - timeSinceLastCheck) / 1000 / 60)
        return NextResponse.json({
          message: `Waiting for check interval. Next check in ${nextCheckIn} minute(s)`,
          action: 'interval_wait',
          lastApiCheckTime: settings.lastApiCheckTime,
          checkIntervalMinutes: settings.checkIntervalMinutes
        })
      }
    }

    await storage.updateStreamSettings({
      lastApiCheckTime: now.toISOString()
    })

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${settings.youtubeChannelId}&eventType=live&type=video&key=${YOUTUBE_API_KEY}`
    
    const response = await fetch(searchUrl)
    const data = await response.json()

    if (!response.ok) {
      console.error('YouTube API error:', data)
      return NextResponse.json(
        { message: 'YouTube API error', error: data, action: 'error' },
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
        message: 'Live stream detected and attendance started!',
        action: 'live_detected',
        videoId,
        liveUrl,
        title: liveVideo.snippet.title,
        autoStopAt,
      })
    }

    return NextResponse.json({
      message: 'No live stream found',
      action: 'no_live',
      channelId: settings.youtubeChannelId,
    })

  } catch (error) {
    console.error('Cron error:', error)
    return NextResponse.json(
      { message: 'Internal server error', action: 'error' },
      { status: 500 }
    )
  }
}
