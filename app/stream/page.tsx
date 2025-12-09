'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Users, Timer, User, Play, Pause, Volume2, VolumeX, Maximize, Radio, Video, VideoOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { checkIfLive, monitorLiveStatus } from '@/lib/youtube-api'

export default function StreamPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ name: string; email: string; branch: string; startTime: number; lastStreamSessionId?: string } | null>(null)
  const [streamSettings, setStreamSettings] = useState<any>(null)
  const [isStreamLive, setIsStreamLive] = useState(true)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [activeViewersCount, setActiveViewersCount] = useState(0)
  const [streamTitle, setStreamTitle] = useState('Live Service')
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const activeViewersIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const attendanceStatusIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const streamSessionIdRef = useRef('')
  const currentStartTimeRef = useRef(0)
  const [isAttendanceActive, setIsAttendanceActive] = useState(false)

  // YouTube Player control state
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isPlaying, setIsPlaying] = useState(false) // Default to false until video confirms playing
  const [isMuted, setIsMuted] = useState(false)
  const [origin, setOrigin] = useState('')
  const [showJumpToLive, setShowJumpToLive] = useState(false)
  const [isLiveStream, setIsLiveStream] = useState(true) // Track if stream is actually live
  const [liveStatusChecked, setLiveStatusChecked] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Set origin after mount to avoid hydration mismatch
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Listen to YouTube player state changes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from YouTube
      if (event.origin !== 'https://www.youtube.com') return

      try {
        const data = JSON.parse(event.data)

        // YouTube sends state updates via postMessage
        if (data.event === 'infoDelivery' && data.info?.playerState !== undefined) {
          const playerState = data.info.playerState

          // YouTube player states:
          // -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
          if (playerState === 1 || playerState === 3) {
            // Playing or buffering = treat as playing
            setIsPlaying(true)
          } else {
            // All other states (unstarted, ended, paused, cued) = not playing
            setIsPlaying(false)
            if (playerState === 2) {
              setShowJumpToLive(true)
            }
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    const storedUser = localStorage.getItem('churchUser')
    if (!storedUser) {
      // No user data found, redirect to login
      router.replace('/')
      return
    }
    
    try {
      const parsedUser = JSON.parse(storedUser)
      
      // Validate that user has required fields
      if (!parsedUser.name || !parsedUser.email || !parsedUser.branch) {
        // Invalid user data, redirect to login
        localStorage.removeItem('churchUser')
        router.replace('/')
        return
      }
      
      setUser(parsedUser)
    } catch (error) {
      // Invalid JSON, redirect to login
      localStorage.removeItem('churchUser')
      router.replace('/')
      return
    }

    fetch('/api/stream/settings')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch settings')
        return res.json()
      })
      .then(data => {
        setStreamSettings(data)
        setIsAttendanceActive(data.isAttendanceActive === 'true')
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

    // Poll for attendance status changes every 10 seconds
    const pollAttendanceStatus = () => {
      fetch('/api/stream/settings')
        .then(res => res.json())
        .then(data => {
          const newStatus = data.isAttendanceActive === 'true'
          setIsAttendanceActive(newStatus)
          setStreamSettings((prev: any) => ({ ...prev, isAttendanceActive: data.isAttendanceActive }))
        })
        .catch(console.error)
    }
    
    attendanceStatusIntervalRef.current = setInterval(pollAttendanceStatus, 10000)

    return () => {
      if (attendanceStatusIntervalRef.current) {
        clearInterval(attendanceStatusIntervalRef.current)
      }
    }
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

  // Monitor live stream status
  useEffect(() => {
    if (!streamSettings?.youtubeUrl) return

    const videoId = extractVideoId(streamSettings.youtubeUrl)
    if (!videoId) return

    let cleanup: (() => void) | undefined

    const startMonitoring = async () => {
      // Initial check
      const isLive = await checkIfLive(videoId)
      setIsLiveStream(isLive)
      setLiveStatusChecked(true)

      // Start monitoring for status changes
      cleanup = await monitorLiveStatus(videoId, (newStatus) => {
        setIsLiveStream(newStatus)

        // If stream went from live to recorded, stop heartbeat
        if (!newStatus && heartbeatIntervalRef.current) {
          console.log('Stream is no longer live, stopping attendance tracking')
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
          sendFinalHeartbeat()
        }
      })
    }

    startMonitoring()

    return () => {
      if (cleanup) cleanup()
    }
  }, [streamSettings])

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
    // Don't hide Jump to Live button - let user decide if they want to jump to live
  }

  const handlePause = () => {
    sendCommand('pauseVideo')
    setIsPlaying(false)
    // Show Jump to Live button immediately when paused
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
        iframeRef.current.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&showinfo=0&enablejsapi=1&playsinline=1&iv_load_policy=3${origin ? `&origin=${origin}` : ''}&t=${timestamp}`
        setIsPlaying(true)
        // Don't show loading state for jump to live - it's faster
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

    // Don't track attendance if admin has disabled it
    if (!isAttendanceActive) {
      console.log('Attendance tracking is disabled by admin')
      // Stop heartbeat if it was running
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      return
    }

    // Don't track attendance if stream is not live
    if (liveStatusChecked && !isLiveStream) {
      console.log('Stream is not live, skipping attendance tracking')
      return
    }

    // Don't start another heartbeat if one is already running
    if (heartbeatIntervalRef.current) {
      console.log('Heartbeat already running')
      return
    }

    const sessionId = generateStreamSessionId(videoId, streamTitle)
    streamSessionIdRef.current = sessionId

    // Check database for existing session
    const initializeSession = async () => {
      try {
        const response = await fetch('/api/attendance/records')
        const records = await response.json()

        // Find existing record for this user and stream session (today's session only)
        const today = new Date().toISOString().split('T')[0]
        const existingRecord = records.find((record: any) => {
          if (record.email !== user.email || record.streamSessionId !== sessionId) return false

          // Check if the record is from today
          const recordDate = new Date(record.startTime).toISOString().split('T')[0]
          return recordDate === today
        })

        if (existingRecord) {
          // Use start time from database, but validate it's reasonable
          const dbStartTime = new Date(existingRecord.startTime).getTime()
          const now = Date.now()
          const timeDiff = now - dbStartTime

          // If the time difference is more than 24 hours, it's invalid - start fresh
          if (timeDiff > 24 * 60 * 60 * 1000 || timeDiff < 0) {
            console.warn('Invalid timestamp in database, starting fresh')
            const newStartTime = now
            currentStartTimeRef.current = newStartTime

            const updatedUser = {
              ...user,
              startTime: newStartTime,
              lastStreamSessionId: sessionId
            }
            setUser(updatedUser)
            localStorage.setItem('churchUser', JSON.stringify(updatedUser))
            setElapsedSeconds(0)
          } else {
            // Valid timestamp from today
            currentStartTimeRef.current = dbStartTime

            const updatedUser = {
              ...user,
              startTime: dbStartTime,
              lastStreamSessionId: sessionId
            }
            setUser(updatedUser)
            localStorage.setItem('churchUser', JSON.stringify(updatedUser))

            // Set initial elapsed time
            setElapsedSeconds(Math.floor(timeDiff / 1000))
          }
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

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          sendHeartbeat()
        }, 30000)

        sendHeartbeat()

        // Start active viewers polling (filtered by branch)
        const fetchActiveViewers = () => {
          const branchParam = user?.branch ? `?branch=${encodeURIComponent(user.branch)}` : ''
          fetch(`/api/attendance/active-count${branchParam}`)
            .then(res => res.json())
            .then(data => setActiveViewersCount(data.count || 0))
            .catch(console.error)
        }
        fetchActiveViewers()
        activeViewersIntervalRef.current = setInterval(fetchActiveViewers, 31000)
      } catch (error) {
        console.error('Failed to check existing session:', error)
      }
    }

    initializeSession()
  }, [streamSettings, user, streamTitle, isLiveStream, liveStatusChecked, isAttendanceActive])

  // Cleanup effect for session intervals
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
      if (activeViewersIntervalRef.current) clearInterval(activeViewersIntervalRef.current)
      sendFinalHeartbeat()
    }
  }, [])

  // Separate effect for timer - runs only when attendance is active
  useEffect(() => {
    if (!currentStartTimeRef.current || !isAttendanceActive) {
      // Stop timer if attendance is not active
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      return
    }

    // Start timer interval - update every second
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - currentStartTimeRef.current) / 1000)
      setElapsedSeconds(elapsed)
    }, 1000)

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [currentStartTimeRef.current, isAttendanceActive])

  // Preload iframe when stream settings are available
  useEffect(() => {
    if (streamSettings?.youtubeUrl && iframeRef.current) {
      setIframeLoading(false) // Remove loading state faster
    }
  }, [streamSettings])

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
          branch: user.branch,
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
      branch: user.branch,
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

  // Show loading state while checking authentication
  if (!user || !streamSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent"></div>
          <p className="mt-2 text-sm text-white">Loading...</p>
        </div>
      </div>
    )
  }

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
                <h1 className="text-xs font-semibold text-white truncate">DLBC {user?.branch || ''} - Streaming Platform</h1>
              </div>
            </div>

            {/* Stats - Compact */}
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 rounded-md">
                <Clock className="h-3 w-3" />
                <span>{format(currentTime, 'h:mm a')}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 rounded-md">
                <Timer className="h-3 w-3" />
                <span>{formatDuration(elapsedSeconds)}</span>
                <span 
                  className={`h-2 w-2 rounded-full ${isAttendanceActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
                  title={isAttendanceActive ? 'Attendance tracking active' : 'Attendance tracking inactive'}
                />
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
      <div className="max-w-7xl mx-auto p-2 sm:p-4 space-y-3 pb-32">
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
            src={`https://www.youtube.com/embed/${extractVideoId(streamSettings.youtubeUrl)}?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&showinfo=0&enablejsapi=1&widgetid=1&playsinline=1&iv_load_policy=3${origin ? `&origin=${origin}` : ''}`}
            title="Church Live Stream"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="eager"
            onLoad={() => {
              setIframeLoading(false)
              // Request state updates from YouTube player
              if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                  JSON.stringify({ event: 'listening', id: 1 }),
                  '*'
                )
                // For live streams, automatically seek to live edge after a short delay
                if (isLiveStream) {
                  setTimeout(() => {
                    iframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'command', func: 'seekTo', args: [9999999, true] }),
                      '*'
                    )
                  }, 1000)
                }
              }
            }}
            onError={() => {
              console.error('Failed to load YouTube stream')
              setIframeLoading(false)
            }}
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

            {/* Jump to Live - Only show when user has paused or might be behind */}
            {isLiveStream && showJumpToLive && (
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
      </div>
    </div>
  )
}