
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, X, Apple, Chrome } from 'lucide-react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if running in standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    setIsStandalone(standalone)

    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(ios)

    // Only show prompt if not already installed and not dismissed
    const dismissed = localStorage.getItem('installPromptDismissed')
    if (!standalone && !dismissed) {
      setShowPrompt(true)
    }

    // Listen for the beforeinstallprompt event (Chrome/Edge)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      setShowPrompt(false)
      localStorage.setItem('installPromptDismissed', 'true')
    }
    
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('installPromptDismissed', 'true')
  }

  // Don't show if already installed
  if (isStandalone || !showPrompt) {
    return null
  }

  return (
    <Card className="border-primary/50 shadow-lg w-full">
      <CardHeader className="pb-3 px-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Download className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
            <CardTitle className="text-base sm:text-lg truncate">Install App</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Install for quick access and offline features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        {isIOS ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs sm:text-sm">
              <Apple className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium mb-1">iOS Installation:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs sm:text-sm">
                  <li>Tap Share button (⬆️)</li>
                  <li>Tap "Add to Home Screen"</li>
                  <li>Tap "Add"</li>
                </ol>
              </div>
            </div>
          </div>
        ) : deferredPrompt ? (
          <Button onClick={handleInstall} className="w-full" size="default">
            <Chrome className="mr-2 h-4 w-4" />
            Install Now
          </Button>
        ) : (
          <div className="text-xs sm:text-sm text-muted-foreground">
            <p className="mb-2 font-medium">Android/Chrome:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Tap menu (⋮)</li>
              <li>Select "Install app"</li>
              <li>Tap "Install"</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
