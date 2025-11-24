
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Users, Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'

export default function StreamPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ name: string; email: string; startTime: number; lastStreamSessionId?: string } | null>(null)
  const [streamSettings, setStreamSettings] = useState<any>(null)
  const [isStreamLive, setIsStreamLive] = useState(true)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [activeViewersCount, setActiveViewersCount] = useState(0)
  const [streamTitle, setStreamTitle] = useState('Live Service')
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const activeViewersIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const streamSessionIdRef = useRef('')
  const currentStartTimeRef = useRef(0)

  useEffect(() => {
    const storedUser = localStorage.getItem('churchUser')
    if (!storedUser) {
      router.push('/')
      return
    }
    const parsedUser = JSON.parse(storedUser)
    setUser(parsedUser)
    
    // Fetch stream settings
    fetch('/api/stream/settings')
      .then(res => res.json())
      .then(data => {
        setStreamSettings(data)
        if (data.youtubeUrl) {
          const videoId = extractVideoId(data.youtubeUrl)
          if (videoId) {
            fetchStreamTitle(videoId)
          }
        }
      })
      .catch(console.error)
  }, [router])

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
      /youtube\.com\/live\/([^&\s?]+)/,
      /youtube\.com\/channel\/([^\/]+)\/live/
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) return match[1]
    }
    return null
  }

  const fetchStreamTitle = async (videoId: string) => {
    try {
      const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
      const data = await response.json()
      if (data.title) {
        setStreamTitle(data.title)
      }
    } catch (error) {
      console.error('Failed to fetch stream title:', error)
    }
  }

  const generateStreamSessionId = (videoId: string, title: string): string => {
    const today = new Date().toISOString().split('T')[0]
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)
    return `${videoId}_${today}_${sanitizedTitle}`
  }

  useEffect(() => {
    if (!streamSettings?.youtubeUrl || !user) return

    const videoId = extractVideoId(streamSettings.youtubeUrl)
    if (!videoId) return

    const sessionId = generateStreamSessionId(videoId, streamTitle)
    streamSessionIdRef.current = sessionId

    // Check if this is a new session
    const isNewSession = !user.lastStreamSessionId || user.lastStreamSessionId !== sessionId
    
    if (isNewSession) {
      // New session - reset start time
      const newStartTime = Date.now()
      currentStartTimeRef.current = newStartTime
      
      const updatedUser = {
        ...user,
        startTime: newStartTime,
        lastStreamSessionId: sessionId
      }
      setUser(updatedUser)
      localStorage.setItem('churchUser', JSON.stringify(updatedUser))
    } else {
      // Continuing same session - use existing start time
      currentStartTimeRef.current = user.startTime
    }

    // Start heartbeat interval (30 seconds)
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat()
    }, 30000)

    // Initial heartbeat
    sendHeartbeat()

    // Start timer
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - currentStartTimeRef.current) / 1000))
    }, 1000)

    // Fetch active viewers count
    const fetchActiveViewers = () => {
      fetch('/api/attendance/active-count')
        .then(res => res.json())
        .then(data => setActiveViewersCount(data.count || 0))
        .catch(console.error)
    }
    fetchActiveViewers()
    activeViewersIntervalRef.current = setInterval(fetchActiveViewers, 10000)

    // Cleanup on unmount
    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (activeViewersIntervalRef.current) clearInterval(activeViewersIntervalRef.current)
      
      // Send final heartbeat using sendBeacon
      sendFinalHeartbeat()
    }
  }, [streamSettings, user, streamTitle])

  const sendHeartbeat = async () => {
    if (!user || !streamSessionIdRef.current) return

    const durationSeconds = Math.floor((Date.now() - currentStartTimeRef.current) / 1000)
    
    try {
      await fetch('/api/attendance/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          streamSessionId: streamSessionIdRef.current,
          streamTitle: streamTitle,
          startTime: new Date(currentStartTimeRef.current).toISOString(),
          durationSeconds,
        }),
      })
    } catch (error) {
      console.error('Heartbeat failed:', error)
    }
  }

  const sendFinalHeartbeat = () => {
    if (!user || !streamSessionIdRef.current) return

    const durationSeconds = Math.floor((Date.now() - currentStartTimeRef.current) / 1000)
    
    const payload = JSON.stringify({
      name: user.name,
      email: user.email,
      streamSessionId: streamSessionIdRef.current,
      streamTitle: streamTitle,
      startTime: new Date(currentStartTimeRef.current).toISOString(),
      durationSeconds,
    })

    // Use sendBeacon for reliability on page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/attendance/heartbeat', payload)
    }
  }

  // Listen for page unload events
  useEffect(() => {
    const handleBeforeUnload = () => {
      sendFinalHeartbeat()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        sendFinalHeartbeat()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  if (!user || !streamSettings) return null

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 pb-3 border-b border-gray-700">
            <img 
              src="https://deeperlifeclapham.org/wp-content/uploads/2024/02/Deeper-life-logo-final-outlines-.png" 
              alt="Logo" 
              className="h-10 w-10 sm:h-16 sm:w-16"
            />
            <div className="text-center">
              <h1 className="text-base sm:text-xl font-bold text-white">Deeper Life Bible Church</h1>
              <p className="text-xs sm:text-base text-gray-300">Pontypridd Region</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="bg-gray-700 border-gray-600">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
                  <div>
                    <p className="text-xs text-gray-400">Started</p>
                    <p className="text-sm sm:text-base font-semibold text-white">
                      {format(new Date(currentStartTimeRef.current), 'h:mm a')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-700 border-gray-600">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Timer className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
                  <div>
                    <p className="text-xs text-gray-400">Duration</p>
                    <p className="text-sm sm:text-base font-semibold text-white">
                      {formatDuration(elapsedSeconds)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-700 border-gray-600">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
                  <div>
                    <p className="text-xs text-gray-400">Watching Now</p>
                    <p className="text-sm sm:text-base font-semibold text-white">
                      {activeViewersCount} {activeViewersCount === 1 ? 'viewer' : 'viewers'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="aspect-video bg-black rounded overflow-hidden shadow-2xl relative">
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
              <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-r-transparent"></div>
                <p className="mt-4 text-white">Loading stream...</p>
              </div>
            </div>
          )}
          <iframe
            width="100%"
            height="100%"
            src={`${streamSettings.youtubeUrl}?autoplay=1&mute=0&fs=1`}
            title="Church Live Stream"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => setIframeLoading(false)}
          />
        </div>

        <Card className="mt-4 bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Viewing as</p>
                <p className="text-lg font-semibold text-white">{user.name}</p>
                <p className="text-sm text-gray-400">{user.email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Session</p>
                <p className="text-lg font-semibold text-white">{streamTitle}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
