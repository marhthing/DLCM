
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Users, Timer, User, Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward, Plus, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

// Extend Window interface for YouTube API
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

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
  
  // YouTube Player API refs and state
  const playerRef = useRef<YT.Player | null>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(100)
  const [ytApiReady, setYtApiReady] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('churchUser')
    if (!storedUser) {
      router.push('/')
      return
    }
    const parsedUser = JSON.parse(storedUser)
    setUser(parsedUser)
    
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

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

      window.onYouTubeIframeAPIReady = () => {
        setYtApiReady(true)
      }
    } else if (window.YT && window.YT.Player) {
      setYtApiReady(true)
    }
  }, [])

  // Initialize YouTube Player when API is ready and we have settings
  useEffect(() => {
    if (!ytApiReady || !streamSettings?.youtubeUrl || playerRef.current) return

    const videoId = extractVideoId(streamSettings.youtubeUrl)
    if (!videoId) return

    playerRef.current = new window.YT.Player('youtube-player', {
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        fs: 0,
        iv_load_policy: 3,
        disablekb: 1,
      },
      events: {
        onReady: (event: YT.PlayerEvent) => {
          setIframeLoading(false)
          setVolume(event.target.getVolume())
          setIsMuted(event.target.isMuted())
        },
        onStateChange: (event: YT.OnStateChangeEvent) => {
          setIsPlaying(event.data === window.YT.PlayerState.PLAYING)
        },
      },
    })

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [ytApiReady, streamSettings])

  // Player control functions
  const handlePlay = useCallback(() => {
    playerRef.current?.playVideo()
  }, [])

  const handlePause = useCallback(() => {
    playerRef.current?.pauseVideo()
  }, [])

  const handleMute = useCallback(() => {
    playerRef.current?.mute()
    setIsMuted(true)
  }, [])

  const handleUnmute = useCallback(() => {
    playerRef.current?.unMute()
    setIsMuted(false)
  }, [])

  const handleVolumeUp = useCallback(() => {
    if (playerRef.current) {
      const currentVolume = playerRef.current.getVolume()
      const newVolume = Math.min(100, currentVolume + 10)
      playerRef.current.setVolume(newVolume)
      setVolume(newVolume)
      if (newVolume > 0 && playerRef.current.isMuted()) {
        playerRef.current.unMute()
        setIsMuted(false)
      }
    }
  }, [])

  const handleVolumeDown = useCallback(() => {
    if (playerRef.current) {
      const currentVolume = playerRef.current.getVolume()
      const newVolume = Math.max(0, currentVolume - 10)
      playerRef.current.setVolume(newVolume)
      setVolume(newVolume)
    }
  }, [])

  const handleSeekForward = useCallback(() => {
    if (playerRef.current) {
      const currentTime = playerRef.current.getCurrentTime()
      playerRef.current.seekTo(currentTime + 10, true)
    }
  }, [])

  const handleSeekBackward = useCallback(() => {
    if (playerRef.current) {
      const currentTime = playerRef.current.getCurrentTime()
      playerRef.current.seekTo(Math.max(0, currentTime - 10), true)
    }
  }, [])

  const handleFullscreen = useCallback(() => {
    const iframe = document.querySelector('#youtube-player') as HTMLIFrameElement
    if (iframe) {
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen()
      } else if ((iframe as any).webkitRequestFullscreen) {
        (iframe as any).webkitRequestFullscreen()
      } else if ((iframe as any).mozRequestFullScreen) {
        (iframe as any).mozRequestFullScreen()
      } else if ((iframe as any).msRequestFullscreen) {
        (iframe as any).msRequestFullscreen()
      }
    }
  }, [])

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
          setElapsedSeconds(Math.floor((Date.now() - dbStartTime) / 1000))
          
          // Update localStorage with database start time
          const updatedUser = {
            ...user,
            startTime: dbStartTime,
            lastStreamSessionId: sessionId
          }
          setUser(updatedUser)
          localStorage.setItem('churchUser', JSON.stringify(updatedUser))
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
        }

        // Start heartbeat and timer
        heartbeatIntervalRef.current = setInterval(() => {
          sendHeartbeat()
        }, 30000)

        sendHeartbeat()

        timerIntervalRef.current = setInterval(() => {
          setElapsedSeconds(Math.floor((Date.now() - currentStartTimeRef.current) / 1000))
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
        <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-2xl relative" ref={playerContainerRef}>
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent"></div>
                <p className="mt-2 text-sm text-white">Loading...</p>
              </div>
            </div>
          )}
          <div id="youtube-player" className="w-full h-full" />
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

            {/* Volume Controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleVolumeDown}
              className="bg-gray-700/50 border-gray-600 text-white"
              data-testid="button-volume-down"
            >
              <Minus className="h-4 w-4 mr-1" />
              Vol-
            </Button>
            <span className="text-white text-sm px-2 min-w-[3rem] text-center" data-testid="text-volume">{volume}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVolumeUp}
              className="bg-gray-700/50 border-gray-600 text-white"
              data-testid="button-volume-up"
            >
              <Plus className="h-4 w-4 mr-1" />
              Vol+
            </Button>

            {/* Seek Controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeekBackward}
              className="bg-gray-700/50 border-gray-600 text-white"
              data-testid="button-seek-backward"
            >
              <SkipBack className="h-4 w-4 mr-1" />
              -10s
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeekForward}
              className="bg-gray-700/50 border-gray-600 text-white"
              data-testid="button-seek-forward"
            >
              <SkipForward className="h-4 w-4 mr-1" />
              +10s
            </Button>

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
