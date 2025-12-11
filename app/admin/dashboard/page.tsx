'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Youtube, Users, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiRequest, queryClient } from '@/lib/queryClient'
import type { AttendanceRecord, StreamSettings } from '@/shared/schema'
import { BRANCHES } from '@/shared/schema'
import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const formatDuration = (durationSeconds: number): string => {
  const hours = Math.floor(durationSeconds / 3600)
  const minutes = Math.floor((durationSeconds % 3600) / 60)
  const seconds = durationSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  return `${minutes}m ${seconds}s`
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function AdminDashboard() {
  const router = useRouter()
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('')
  const { toast } = useToast()

  const [filterDate, setFilterDate] = useState('')
  const [filterTitle, setFilterTitle] = useState('')
  const [filterBranch, setFilterBranch] = useState('')

  const [channelId, setChannelId] = useState('')
  const [checkDay, setCheckDay] = useState('Monday')
  const [checkStartTime, setCheckStartTime] = useState('15:00')
  const [checkEndTime, setCheckEndTime] = useState('17:00')
  const [attendanceDuration, setAttendanceDuration] = useState(4)

  const [currentPage, setCurrentPage] = useState(1)
  const recordsPerPage = 15

  useEffect(() => {
    const isAdmin = localStorage.getItem('adminAuth')
    if (!isAdmin) {
      router.push('/admin/login')
      return
    }
  }, [router])

  const { data: attendanceRecords = [], isLoading: isLoadingRecords, isError, error } = useQuery<AttendanceRecord[]>({
    queryKey: ['/api/attendance/records', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/attendance/records')
      if (!res.ok) throw new Error('Failed to fetch records')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const { data: streamSettings, refetch: refetchSettings } = useQuery<StreamSettings>({
    queryKey: ['/api/stream/settings'],
  })

  useEffect(() => {
    if (streamSettings) {
      setChannelId(streamSettings.youtubeChannelId || '')
      setCheckDay(streamSettings.checkDay || 'Monday')
      setCheckStartTime(streamSettings.checkStartTime || '15:00')
      setCheckEndTime(streamSettings.checkEndTime || '17:00')
      setAttendanceDuration(streamSettings.autoAttendanceDurationHours || 4)
    }
  }, [streamSettings])

  const uniqueTitles = Array.from(new Set(attendanceRecords.map(record => record.streamTitle))).sort()

  const filteredRecords = attendanceRecords.filter(record => {
    const recordDate = format(new Date(record.startTime), 'yyyy-MM-dd')
    const dateMatch = filterDate ? recordDate === filterDate : true
    const titleMatch = filterTitle ? record.streamTitle === filterTitle : true
    const branchMatch = filterBranch && filterBranch !== 'all' ? record.branch === filterBranch : true
    return dateMatch && titleMatch && branchMatch
  })

  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage)
  const startIndex = (currentPage - 1) * recordsPerPage
  const endIndex = startIndex + recordsPerPage
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [filterDate, filterTitle, filterBranch])

  const toggleAttendanceMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      return apiRequest('POST', '/api/attendance/toggle', { isActive })
    },
    onSuccess: async () => {
      await refetchSettings()
      toast({
        title: 'Success',
        description: 'Attendance tracking updated!',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update attendance tracking.',
        variant: 'destructive',
      })
    },
  })

  const updateUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      let embedUrl = url
      
      if (url.includes('youtube.com/live/')) {
        const videoId = url.split('/live/')[1].split('?')[0]
        embedUrl = `https://www.youtube.com/embed/${videoId}`
      }
      else if (url.includes('youtube.com/watch?v=')) {
        const videoId = url.split('v=')[1].split('&')[0]
        embedUrl = `https://www.youtube.com/embed/${videoId}`
      }
      else if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1].split('?')[0]
        embedUrl = `https://www.youtube.com/embed/${videoId}`
      }
      else if (url.includes('youtube.com/embed/')) {
        embedUrl = url
      }
      else if (!url.includes('http')) {
        embedUrl = `https://www.youtube.com/embed/${url}`
      }
      
      return apiRequest('PUT', '/api/stream/settings', { url: embedUrl })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stream/settings'] })
      toast({
        title: 'Success',
        description: 'YouTube link updated successfully!',
      })
      setNewYoutubeUrl('')
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update YouTube link.',
        variant: 'destructive',
      })
    },
  })

  const handleUpdateUrl = () => {
    if (newYoutubeUrl) {
      updateUrlMutation.mutate(newYoutubeUrl)
    }
  }

  const updateYoutubeApiSettingsMutation = useMutation({
    mutationFn: async (settings: {
      youtubeChannelId?: string
      checkDay?: string
      checkStartTime?: string
      checkEndTime?: string
      autoAttendanceDurationHours?: number
    }) => {
      return apiRequest('PUT', '/api/stream/settings', settings)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stream/settings'] })
      toast({
        title: 'Success',
        description: 'YouTube API settings updated!',
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update YouTube API settings.',
        variant: 'destructive',
      })
    },
  })

  const handleSaveYoutubeApiSettings = () => {
    updateYoutubeApiSettingsMutation.mutate({
      youtubeChannelId: channelId,
      checkDay,
      checkStartTime,
      checkEndTime,
      autoAttendanceDurationHours: attendanceDuration,
    })
  }

  const checkLiveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/youtube/check-live', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to check live status')
      return res.json()
    },
    onSuccess: (data) => {
      refetchSettings()
      toast({
        title: data.liveDetected === false ? 'No Live Stream' : data.skipped ? 'Check Skipped' : 'Live Stream Found!',
        description: data.message,
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to check for live stream.',
        variant: 'destructive',
      })
    },
  })

  const handleLogout = () => {
    localStorage.removeItem('adminAuth')
    router.push('/')
  }

  const exportToPDF = () => {
    const recordsToExport = filteredRecords.length > 0 ? filteredRecords : attendanceRecords

    const doc = new jsPDF()

    const logoUrl = '/church-logo.jpg'
    const img = new Image()
    img.src = logoUrl

    img.onload = () => {
      doc.setFillColor(13, 71, 161)
      doc.rect(0, 0, 210, 45, 'F')

      doc.addImage(img, 'JPEG', 14, 8, 30, 30)

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('DEEPER LIFE BIBLE CHURCH', 50, 18)

      doc.setFontSize(14)
      doc.setFont('helvetica', 'normal')
      doc.text(filterBranch && filterBranch !== 'all' ? `${filterBranch} Branch` : 'All Branches', 50, 26)

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('ATTENDANCE RECORDS', 50, 37)

      doc.setDrawColor(255, 255, 255)
      doc.setLineWidth(0.5)
      doc.line(14, 42, 196, 42)

      doc.setTextColor(0, 0, 0)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generated on: ${format(new Date(), 'MMMM dd, yyyy')} at ${format(new Date(), 'h:mm a')}`, 14, 52)
      doc.text(`Total Records: ${recordsToExport.length}`, 14, 58)

      const tableData = recordsToExport.map((record, index) => [
        (index + 1).toString(),
        record.name,
        record.branch,
        record.streamTitle,
        format(new Date(record.startTime), 'MMM dd, yyyy'),
      ])

      autoTable(doc, {
        head: [['S/N', 'Name', 'Branch', 'Service', 'Date']],
        body: tableData,
        startY: 65,
        tableWidth: 'auto',
        styles: { 
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: { 
          fillColor: [13, 71, 161],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 15 },
          1: { cellWidth: 50 },
          2: { cellWidth: 40 },
          3: { cellWidth: 50 },
          4: { halign: 'center', cellWidth: 30 },
        },
      })

      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(128, 128, 128)
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        )
        doc.text(
          `Deeper Life Bible Church`,
          14,
          doc.internal.pageSize.height - 10
        )
      }

      doc.save(`DLBC-${filterBranch && filterBranch !== 'all' ? filterBranch : 'All-Branches'}-Attendance-${format(new Date(), 'yyyy-MM-dd')}.pdf`)

      toast({
        title: 'Export successful',
        description: `${recordsToExport.length} attendance records have been exported to PDF`,
      })
    }

    img.onerror = () => {
      doc.setFillColor(13, 71, 161)
      doc.rect(0, 0, 210, 45, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('DEEPER LIFE BIBLE CHURCH', 14, 18)

      doc.setFontSize(14)
      doc.setFont('helvetica', 'normal')
      doc.text(filterBranch && filterBranch !== 'all' ? `${filterBranch} Branch` : 'All Branches', 14, 26)

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('ATTENDANCE RECORDS', 14, 37)

      doc.setTextColor(0, 0, 0)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generated on: ${format(new Date(), 'MMMM dd, yyyy')} at ${format(new Date(), 'h:mm a')}`, 14, 52)
      doc.text(`Total Records: ${recordsToExport.length}`, 14, 58)

      const tableData = recordsToExport.map((record, index) => [
        (index + 1).toString(),
        record.name,
        record.branch,
        record.streamTitle,
        format(new Date(record.startTime), 'MMM dd, yyyy'),
      ])

      autoTable(doc, {
        head: [['S/N', 'Name', 'Branch', 'Service', 'Date']],
        body: tableData,
        startY: 65,
        tableWidth: 'auto',
        styles: { 
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: { 
          fillColor: [13, 71, 161],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 15 },
          1: { cellWidth: 50 },
          2: { cellWidth: 40 },
          3: { cellWidth: 50 },
          4: { halign: 'center', cellWidth: 30 },
        },
      })

      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(128, 128, 128)
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        )
        doc.text(
          `Deeper Life Bible Church`,
          14,
          doc.internal.pageSize.height - 10
        )
      }

      doc.save(`DLBC-${filterBranch && filterBranch !== 'all' ? filterBranch : 'All-Branches'}-Attendance-${format(new Date(), 'yyyy-MM-dd')}.pdf`)

      toast({
        title: 'Export successful',
        description: `${recordsToExport.length} attendance records have been exported to PDF`,
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Deeper Life Bible Church</p>
          </div>
          <Button
            data-testid="button-logout"
            variant="ghost"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Youtube className="text-red-600" data-testid="icon-youtube" />
              Stream Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <h3 className="font-semibold">Attendance Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  {streamSettings?.isAttendanceActive === 'true' ? 'Currently tracking attendance' : 'Attendance tracking disabled'}
                </p>
              </div>
              <Button
                data-testid="button-toggle-attendance"
                onClick={() => toggleAttendanceMutation.mutate(streamSettings?.isAttendanceActive !== 'true')}
                disabled={toggleAttendanceMutation.isPending}
                variant={streamSettings?.isAttendanceActive === 'true' ? 'destructive' : 'default'}
              >
                {toggleAttendanceMutation.isPending 
                  ? 'Updating...' 
                  : streamSettings?.isAttendanceActive === 'true' 
                    ? 'Stop Attendance' 
                    : 'Start Attendance'}
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="youtube-url">YouTube URL (any format)</Label>
              <Input
                id="youtube-url"
                data-testid="input-youtube-url"
                type="text"
                value={newYoutubeUrl}
                onChange={(e) => setNewYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or CHANNEL_ID/live"
              />
              <p className="text-sm text-muted-foreground">
                Supports: youtube.com/watch?v=, youtu.be/, CHANNEL_ID/live, or embed URLs
              </p>
            </div>
            <Button
              data-testid="button-update-url"
              onClick={handleUpdateUrl}
              disabled={!newYoutubeUrl || updateUrlMutation.isPending}
            >
              {updateUrlMutation.isPending ? 'Updating...' : 'Update Stream URL'}
            </Button>
            {streamSettings ? (
              <p className="text-sm text-muted-foreground" data-testid="text-current-url">
                Current URL: <code className="bg-muted px-2 py-1 rounded-sm text-xs">{streamSettings.youtubeUrl}</code>
              </p>
            ) : (
              <p className="text-sm text-amber-600 font-medium" data-testid="text-no-url">
                No stream URL configured yet. Please set one above.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Youtube className="text-red-600" data-testid="icon-youtube-api" />
              YouTube API Auto-Detection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure automatic live stream detection. The system will check for live streams on the scheduled day and time, then automatically start attendance tracking.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="channel-id">YouTube Channel ID</Label>
                <Input
                  id="channel-id"
                  data-testid="input-channel-id"
                  type="text"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="UCxxxxxxxxxxxxxxxx"
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your YouTube channel URL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="check-day">Check Day</Label>
                <Select value={checkDay} onValueChange={setCheckDay}>
                  <SelectTrigger id="check-day" data-testid="select-check-day">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="check-start-time">Check Start Time</Label>
                <Input
                  id="check-start-time"
                  data-testid="input-check-start-time"
                  type="time"
                  value={checkStartTime}
                  onChange={(e) => setCheckStartTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="check-end-time">Check End Time</Label>
                <Input
                  id="check-end-time"
                  data-testid="input-check-end-time"
                  type="time"
                  value={checkEndTime}
                  onChange={(e) => setCheckEndTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attendance-duration">Auto Attendance Duration (hours)</Label>
                <Input
                  id="attendance-duration"
                  data-testid="input-attendance-duration"
                  type="number"
                  min={1}
                  max={12}
                  value={attendanceDuration}
                  onChange={(e) => setAttendanceDuration(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Attendance will auto-stop after this many hours
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                data-testid="button-save-api-settings"
                onClick={handleSaveYoutubeApiSettings}
                disabled={updateYoutubeApiSettingsMutation.isPending}
              >
                {updateYoutubeApiSettingsMutation.isPending ? 'Saving...' : 'Save API Settings'}
              </Button>
              <Button
                data-testid="button-check-live-now"
                variant="outline"
                onClick={() => checkLiveMutation.mutate()}
                disabled={checkLiveMutation.isPending || !channelId}
              >
                {checkLiveMutation.isPending ? 'Checking...' : 'Check Live Now'}
              </Button>
            </div>

            {streamSettings?.autoDetectedUrl && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Last Auto-Detected Stream:</p>
                <code className="text-xs break-all">{streamSettings.autoDetectedUrl}</code>
                {streamSettings.lastLiveCheckDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Detected on: {streamSettings.lastLiveCheckDate}
                  </p>
                )}
              </div>
            )}

            {streamSettings?.attendanceAutoStopAt && streamSettings.isAttendanceActive === 'true' && (
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Attendance Auto-Stop Scheduled
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Will stop at: {format(new Date(streamSettings.attendanceAutoStopAt), 'MMM dd, yyyy h:mm a')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="text-primary" data-testid="icon-users" />
              <span data-testid="text-records-count">
                All Attendance Records ({attendanceRecords.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingRecords ? (
              <p className="text-center py-8 text-muted-foreground" data-testid="text-loading-records">
                Loading attendance records...
              </p>
            ) : isError ? (
              <div className="text-center py-8" data-testid="text-error-records">
                <p className="text-red-500 mb-2">Error loading attendance records</p>
                <p className="text-muted-foreground text-sm">{error?.message || 'Unknown error'}</p>
              </div>
            ) : attendanceRecords.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground" data-testid="text-no-records">
                No attendance records yet
              </p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[150px]">
                    <Label htmlFor="filter-branch">Filter by Branch</Label>
                    <Select value={filterBranch} onValueChange={setFilterBranch}>
                      <SelectTrigger id="filter-branch" className="mt-1">
                        <SelectValue placeholder="All Branches" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Branches</SelectItem>
                        {BRANCHES.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <Label htmlFor="filter-date">Filter by Date</Label>
                    <Input
                      id="filter-date"
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <Label htmlFor="filter-title">Filter by Service</Label>
                    <select
                      id="filter-title"
                      value={filterTitle}
                      onChange={(e) => setFilterTitle(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      <option value="">All Services</option>
                      {uniqueTitles.map(title => (
                        <option key={title} value={title}>{title}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={() => {
                      setFilterDate('')
                      setFilterTitle('')
                      setFilterBranch('')
                    }}
                    variant="outline"
                  >
                    Clear Filters
                  </Button>
                  <Button
                    data-testid="button-export-pdf"
                    onClick={exportToPDF}
                    disabled={attendanceRecords.length === 0}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="mr-2 h-4 w-4" data-testid="icon-download" />
                    Export PDF
                  </Button>
                </div>
                <div className="mb-2 text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredRecords.length)} of {filteredRecords.length} {filterDate || filterTitle || filterBranch ? 'filtered' : ''} records
                  {(filterDate || filterTitle || filterBranch) && ` (${attendanceRecords.length} total)`}
                </div>
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">S/N</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Start Time</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRecords.map((record, index) => (
                        <TableRow key={record.id} data-testid={`row-attendance-${record.id}`}>
                          <TableCell className="font-medium">{startIndex + index + 1}</TableCell>
                          <TableCell className="font-medium">{record.name}</TableCell>
                          <TableCell>{record.branch}</TableCell>
                          <TableCell className="font-medium">{record.streamTitle}</TableCell>
                          <TableCell>
                            {format(new Date(record.startTime), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            {format(new Date(record.startTime), 'h:mm a')}
                          </TableCell>
                          <TableCell>
                            {formatDuration(record.durationSeconds)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        data-testid="button-previous-page"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          return page === 1 || 
                                 page === totalPages || 
                                 Math.abs(page - currentPage) <= 1
                        })
                        .map((page, index, array) => {
                          const showEllipsisBefore = index > 0 && page - array[index - 1] > 1
                          return (
                            <>
                              {showEllipsisBefore && (
                                <span key={`ellipsis-${page}`} className="px-2 py-1">...</span>
                              )}
                              <Button
                                key={page}
                                data-testid={`button-page-${page}`}
                                variant={currentPage === page ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                                className="min-w-[2.5rem]"
                              >
                                {page}
                              </Button>
                            </>
                          )
                        })}
                      <Button
                        data-testid="button-next-page"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
