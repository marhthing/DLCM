'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

const APP_VERSION = '6'

export default function ServiceWorkerRegister() {
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(iOS)

    // iOS fallback: check version in localStorage
    if (iOS) {
      const savedVersion = localStorage.getItem('app-version')
      if (savedVersion && savedVersion !== APP_VERSION) {
        setShowUpdateBanner(true)
      }
      localStorage.setItem('app-version', APP_VERSION)
    }

    // Standard service worker update check
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        registration.update()

        if (registration.waiting) {
          setWaitingWorker(registration.waiting)
          setShowUpdateBanner(true)
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker)
                setShowUpdateBanner(true)
              }
            })
          }
        })
      })

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
    if (isIOS) {
      // For iOS, clear caches and reload
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name))
        }).finally(() => {
          location.reload()
        })
      } else {
        location.reload()
      }
    } else if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    } else {
      window.location.reload()
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
