
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, CheckCircle, AlertCircle, Timer, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'

export default function StreamPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ name: string; email: string; startTime: number; lastStreamSessionId?: string } | null>(null)
  const [streamSettings, setStreamSettings] = useState<any>(null)
  const [isStreamLive, setIsStreamLive] = useState(false)
  const [checkingLiveStatus, setCheckingLiveStatus] = useState(true)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [activeViewersCount, setActiveViewersCount] = useState(0)
  const [streamTitle, setStreamTitle] = useState('')
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const streamSessionIdRef = useRef('')
  const currentStartTimeRef = useRef(0)

  useEffect(() => {
    const storedUser = localStorage.getItem('churchUser')
    if (!storedUser) {
      router.push('/')
      return
    }
    setUser(JSON.parse(storedUser))
    
    // Fetch stream settings
    fetch('/api/stream/settings')
      .then(res => res.json())
      .then(data => setStreamSettings(data))
      .catch(console.error)
  }, [router])

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
      /youtube\.com\/live\/([^&\s?]+)/
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) return match[1]
    }
    return null
  }

  const generateStreamSessionId = (videoId: string, title: string): string => {
    const today = new Date().toISOString().split('T')[0]
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)
    return `${videoId}_${today}_${sanitizedTitle}`
  }

  const sendHeartbeat = async (params?: any) => {
    if (!isStreamLive) return
    const name = params?.name || user?.name
    const email = params?.email || user?.email
    const sessionId = params?.streamSessionId || streamSessionIdRef.current
    const title = params?.streamTitle || streamTitle || 'Live Stream'
    const startTime = params?.startTime || currentStartTimeRef.current || user?.startTime || Date.now()

    if (!name || !email || !sessionId) return

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000)
    
    try {
      await fetch('/api/attendance/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          streamSessionId: sessionId,
          streamTitle: title,
          startTime: new Date(startTime).toISOString(),
          durationSeconds,
        }),
      })
    } catch (error) {
      console.error('Heartbeat failed:', error)
    }
  }

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
      </div>
    </div>
  )
}
