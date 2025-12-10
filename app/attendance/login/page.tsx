'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useMutation } from '@tanstack/react-query'
import { apiRequest } from '@/lib/queryClient'
import { BRANCHES } from '@/shared/schema'

export default function AttendanceLogin() {
  const router = useRouter()
  const [branch, setBranch] = useState('')
  const [password, setPassword] = useState('')
  const { toast } = useToast()

  const loginMutation = useMutation({
    mutationFn: async (password: string) => {
      return apiRequest('POST', '/api/admin/login', { password })
    },
    onSuccess: () => {
      localStorage.setItem('attendanceAuth', 'true')
      localStorage.setItem('attendanceBranch', branch)
      router.push('/attendance/dashboard')
    },
    onError: () => {
      toast({
        title: 'Login Failed',
        description: 'Incorrect password. Please try again.',
        variant: 'destructive',
      })
    },
  })

  const handleLogin = () => {
    if (password && branch) {
      loginMutation.mutate(password)
    }
  }

  const handleBackToLogin = () => {
    router.push('/')
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
            <CardTitle className="text-3xl font-bold mb-2">Attendance Record</CardTitle>
            <CardDescription className="text-base font-medium">
              Deeper Life Bible Church
            </CardDescription>
            <CardDescription className="text-sm mt-2">
              Login to manage attendance for your branch
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branch">Select Your Branch</Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger id="branch" data-testid="select-attendance-branch">
                  <SelectValue placeholder="Choose your branch" />
                </SelectTrigger>
                <SelectContent>
                  {BRANCHES.map((b) => (
                    <SelectItem key={b} value={b} data-testid={`option-attendance-branch-${b}`}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="input-attendance-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button
              data-testid="button-attendance-login"
              onClick={handleLogin}
              className="w-full"
              disabled={!password || !branch || loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Logging in...' : 'Login'}
            </Button>
          </div>
          <div className="text-center">
            <Button
              variant="ghost"
              data-testid="link-back-to-login"
              onClick={handleBackToLogin}
              className="text-sm"
            >
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
