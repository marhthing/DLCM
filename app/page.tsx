'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import InstallPrompt from '@/components/install-prompt'
import { BRANCHES } from '@/shared/schema'

export default function LoginPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [branch, setBranch] = useState('')

  const handleJoinStream = () => {
    if (name && email && branch) {
      localStorage.setItem('churchUser', JSON.stringify({ name, email, branch, startTime: Date.now() }))
      router.push('/stream')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="w-full">
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
              <CardDescription className="text-base font-medium">Streaming Platform</CardDescription>
              <CardDescription className="text-sm mt-2">
                Sign in to watch and record your attendance
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="branch">Select Your Branch</Label>
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger id="branch" data-testid="select-branch">
                    <SelectValue placeholder="Choose your branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map((b) => (
                      <SelectItem key={b} value={b} data-testid={`option-branch-${b}`}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  data-testid="input-name"
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
                  data-testid="input-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinStream()}
                />
              </div>
              <Button 
                data-testid="button-join-stream"
                onClick={handleJoinStream} 
                className="w-full" 
                disabled={!name || !email || !branch}
              >
                Join Live Stream
              </Button>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t">
              <p className="text-xs text-center text-muted-foreground mb-1">Staff Access</p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/attendance/login')} 
                  className="flex-1 text-sm" 
                  data-testid="button-attendance-access"
                >
                  Attendance Record
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => router.push('/admin/login')} 
                  className="flex-1 text-sm" 
                  data-testid="button-admin-access"
                >
                  Admin
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <InstallPrompt />
      </div>
    </div>
  )
}
