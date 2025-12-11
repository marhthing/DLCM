'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export default function ServiceWorkerRegister() {
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        // Check for updates immediately on page load
        registration.update()

        // Check for waiting worker (update ready)
        if (registration.waiting) {
          setWaitingWorker(registration.waiting)
          setShowUpdateBanner(true)
        }

        // Listen for new updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                setWaitingWorker(newWorker)
                setShowUpdateBanner(true)
              }
            })
          }
        })

        // Check for updates every 5 minutes while app is open
        const updateInterval = setInterval(() => {
          registration.update()
        }, 5 * 60 * 1000)

        // Also check when page becomes visible again (user switches back to app)
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            registration.update()
          }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
          clearInterval(updateInterval)
          document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
      })

      // Handle controller change (when new SW takes over)
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true
          window.location.reload()
        }
      })
    }
  }, [])

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    }
  }

  if (!showUpdateBanner) return null

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white p-4 z-50 flex items-center justify-between gap-4"
      data-testid="update-banner"
    >
      <div className="flex-1">
        <p className="font-medium">A new version is available</p>
        <p className="text-sm text-blue-100">Tap update to get the latest features</p>
      </div>
      <Button 
        onClick={handleUpdate}
        variant="secondary"
        className="bg-white text-blue-600 shrink-0"
        data-testid="button-update-app"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Update Now
      </Button>
    </div>
  )
}
