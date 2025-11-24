
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const handleJoinStream = () => {
    if (name && email) {
      localStorage.setItem('churchUser', JSON.stringify({ name, email, startTime: Date.now() }))
      router.push('/stream')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-indigo-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center mx-auto">
            <img 
              src="https://deeperlifeclapham.org/wp-content/uploads/2024/02/Deeper-life-logo-final-outlines-.png" 
              alt="Deeper Life Bible Church Logo"
              className="h-20 w-auto object-contain"
            />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold mb-2">Deeper Life Bible Church</CardTitle>
            <CardDescription className="text-base font-medium">Pontypridd Region - Streaming Platform</CardDescription>
            <CardDescription className="text-sm mt-2">
              Sign in to watch and record your attendance
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                onKeyDown={(e) => e.key === 'Enter' && handleJoinStream()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                onKeyDown={(e) => e.key === 'Enter' && handleJoinStream()}
              />
            </div>
            <Button onClick={handleJoinStream} className="w-full" disabled={!name || !email}>
              Join Live Stream
            </Button>
          </div>
          <div className="text-center">
            <Button variant="ghost" onClick={() => router.push('/admin/login')} className="text-sm">
              Admin Access
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
