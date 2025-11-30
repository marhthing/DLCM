
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Users, Timer, User, Play, Pause, Volume2, VolumeX, Maximize, Radio } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  
  // YouTube Player control state
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [origin, setOrigin] = useState('')
  const [showJumpToLive, setShowJumpToLive] = useState(false)
  
  // Set origin after mount to avoid hydration mismatch
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    const storedUser = localStorage.getItem('churchUser')
    if (!storedUser) {
      router.push('/')
      return
    }
    const parsedUser = JSON.parse(storedUser)
    setUser(parsedUser)
    
    fetch('/api/stream/settings')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch settings')
        return res.json()
      })
      .then(data => {
        setStreamSettings(data)
        if (data.youtubeUrl) {
          const videoId = extractVideoId(data.youtubeUrl)
          if (videoId) {
            fetchStreamTitle(videoId)
          }
        }
      })
      .catch(err => {
        console.error('Error fetching stream settings:', err)
      })
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

  // Helper function to send commands to YouTube iframe via postMessage
  const sendCommand = (command: string, args: any[] = []) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: command, args }),
        '*'
      )
    }
  }

  // Player control functions using postMessage API
  const handlePlay = () => {
    sendCommand('playVideo')
    setIsPlaying(true)
  }

  const handlePause = () => {
    sendCommand('pauseVideo')
    setIsPlaying(false)
    setShowJumpToLive(true)
  }

  const handleMute = () => {
    sendCommand('mute')
    setIsMuted(true)
  }

  const handleUnmute = () => {
    sendCommand('unMute')
    setIsMuted(false)
  }

  const handleFullscreen = () => {
    if (iframeRef.current) {
      if (iframeRef.current.requestFullscreen) {
        iframeRef.current.requestFullscreen()
      } else if ((iframeRef.current as any).webkitRequestFullscreen) {
        (iframeRef.current as any).webkitRequestFullscreen()
      } else if ((iframeRef.current as any).mozRequestFullScreen) {
        (iframeRef.current as any).mozRequestFullScreen()
      } else if ((iframeRef.current as any).msRequestFullscreen) {
        (iframeRef.current as any).msRequestFullscreen()
      }
    }
  }

  // Jump to live - reloads the iframe to get back to the live stream position
  const handleGoLive = () => {
    if (iframeRef.current && streamSettings?.youtubeUrl) {
      const videoId = extractVideoId(streamSettings.youtubeUrl)
      if (videoId) {
        // Force reload by adding a timestamp to bust cache
        const timestamp = Date.now()
        iframeRef.current.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&showinfo=0&enablejsapi=1${origin ? `&origin=${origin}` : ''}&t=${timestamp}`
        setIsPlaying(true)
        setIframeLoading(true)
        setShowJumpToLive(false)
      }
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

    // Don't start heartbeat until we have the real stream title (not the default)
    if (streamTitle === 'Live Service') return

    const sessionId = generateStreamSessionId(videoId, streamTitle)
    streamSessionIdRef.current = sessionId

    // Check database for existing session
    const initializeSession = async () => {
      try {
        const response = await fetch('/api/attendance/records')
        const records = await response.json()
        
        // Find existing record for this user and stream session
        const existingRecord = records.find((record: any) => 
          record.email === user.email && record.streamSessionId === sessionId
        )

        if (existingRecord) {
          // Use start time from database
          const dbStartTime = new Date(existingRecord.startTime).getTime()
          currentStartTimeRef.current = dbStartTime
          
          // Update localStorage with database start time
          const updatedUser = {
            ...user,
            startTime: dbStartTime,
            lastStreamSessionId: sessionId
          }
          setUser(updatedUser)
          localStorage.setItem('churchUser', JSON.stringify(updatedUser))
          
          // Set initial elapsed time
          setElapsedSeconds(Math.floor((Date.now() - dbStartTime) / 1000))
        } else {
          // New session - create new start time
          const newStartTime = Date.now()
          currentStartTimeRef.current = newStartTime
          
          const updatedUser = {
            ...user,
            startTime: newStartTime,
            lastStreamSessionId: sessionId
          }
          setUser(updatedUser)
          localStorage.setItem('churchUser', JSON.stringify(updatedUser))
          
          // Set initial elapsed time to 0
          setElapsedSeconds(0)
        }

        // Start heartbeat and timer
        heartbeatIntervalRef.current = setInterval(() => {
          sendHeartbeat()
        }, 30000)

        sendHeartbeat()

        // Start timer interval - update every second
        timerIntervalRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - currentStartTimeRef.current) / 1000)
          setElapsedSeconds(elapsed)
        }, 1000)

        const fetchActiveViewers = () => {
          fetch('/api/attendance/active-count')
            .then(res => res.json())
            .then(data => setActiveViewersCount(data.count || 0))
            .catch(console.error)
        }
        fetchActiveViewers()
        activeViewersIntervalRef.current = setInterval(fetchActiveViewers, 5000)
      } catch (error) {
        console.error('Failed to check existing session:', error)
      }
    }

    initializeSession()

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (activeViewersIntervalRef.current) clearInterval(activeViewersIntervalRef.current)
      
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

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/attendance/heartbeat', payload)
    }
  }

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
    return `${minutes}m ${secs}s`
  }

  if (!user || !streamSettings) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Compact Header */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            {/* Logo & Title */}
            <div className="flex items-center gap-2 min-w-0">
              <img 
                src="https://deeperlifeclapham.org/wp-content/uploads/2024/02/Deeper-life-logo-final-outlines-.png" 
                alt="Logo" 
                className="h-8 w-8 flex-shrink-0"
              />
              <div className="min-w-0 hidden sm:block">
                <h1 className="text-xs font-semibold text-white truncate">DLBC Pontypridd - Streaming Platform</h1>
              </div>
            </div>

            {/* Stats - Compact */}
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 rounded-md">
                <Clock className="h-3 w-3" />
                <span className="hidden sm:inline">{format(new Date(currentStartTimeRef.current), 'h:mm a')}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 rounded-md">
                <Timer className="h-3 w-3" />
                <span>{formatDuration(elapsedSeconds)}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 text-purple-400 rounded-md">
                <Users className="h-3 w-3" />
                <span>{activeViewersCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-2 sm:p-4 space-y-3">
        {/* Video Player */}
        <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-2xl relative">
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent"></div>
                <p className="mt-2 text-sm text-white">Loading...</p>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${extractVideoId(streamSettings.youtubeUrl)}?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&showinfo=0&enablejsapi=1${origin ? `&origin=${origin}` : ''}`}
            title="Church Live Stream"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => setIframeLoading(false)}
            style={{ pointerEvents: 'none' }}
          />
        </div>

        {/* Custom Video Controls */}
        <div className="bg-gray-800/70 backdrop-blur-sm rounded-lg p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {/* Play/Pause */}
            {isPlaying ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePause}
                className="bg-gray-700/50 border-gray-600 text-white"
                data-testid="button-pause"
              >
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlay}
                className="bg-gray-700/50 border-gray-600 text-white"
                data-testid="button-play"
              >
                <Play className="h-4 w-4 mr-1" />
                Play
              </Button>
            )}

            {/* Mute/Unmute */}
            {isMuted ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnmute}
                className="bg-gray-700/50 border-gray-600 text-white"
                data-testid="button-unmute"
              >
                <VolumeX className="h-4 w-4 mr-1" />
                Unmute
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMute}
                className="bg-gray-700/50 border-gray-600 text-white"
                data-testid="button-mute"
              >
                <Volume2 className="h-4 w-4 mr-1" />
                Mute
              </Button>
            )}

            {/* Jump to Live - Only show when user has paused or rewinded */}
            {showJumpToLive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoLive}
                className="bg-red-600/80 border-red-500 text-white animate-pulse ring-2 ring-red-400"
                data-testid="button-go-live"
              >
                <Radio className="h-4 w-4 mr-1" />
                Jump to Live
              </Button>
            )}

            {/* Fullscreen */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleFullscreen}
              className="bg-gray-700/50 border-gray-600 text-white"
              data-testid="button-fullscreen"
            >
              <Maximize className="h-4 w-4 mr-1" />
              Fullscreen
            </Button>
          </div>
        </div>

        {/* Video Title */}
        <div className="px-2">
          <h2 className="text-lg sm:text-xl font-semibold text-white" data-testid="text-stream-title">{streamTitle}</h2>
        </div>

        {/* Info Cards - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {/* User Info */}
          <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700/50">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">Viewing as</p>
                  <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stream Info */}
          <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700/50">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <div className="h-2 w-2 bg-white rounded-full animate-pulse"></div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">Now Playing</p>
                  <p className="text-sm font-semibold text-white line-clamp-2">{streamTitle}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
