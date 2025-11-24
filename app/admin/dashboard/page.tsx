'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Youtube, Users, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiRequest, queryClient } from '@/lib/queryClient'
import type { AttendanceRecord, StreamSettings } from '@/shared/schema'
import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// Helper function to format duration
const formatDuration = (durationSeconds: number): string => {
  const minutes = Math.floor(durationSeconds / 60)
  const seconds = durationSeconds % 60
  return `${minutes} mins ${seconds} secs`
}

export default function AdminDashboard() {
  const router = useRouter()
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('')
  const { toast } = useToast()

  // Filtering state
  const [filterDate, setFilterDate] = useState('')
  const [filterTitle, setFilterTitle] = useState('')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const recordsPerPage = 15

  useEffect(() => {
    const isAdmin = localStorage.getItem('adminAuth')
    if (!isAdmin) {
      router.push('/admin/login')
    }
  }, [router])

  const { data: attendanceRecords = [], isLoading: isLoadingRecords } = useQuery<AttendanceRecord[]>({
    queryKey: ['/api/attendance/records'],
  })

  const { data: streamSettings } = useQuery<StreamSettings>({
    queryKey: ['/api/stream/settings'],
  })

  // Derived state for unique stream titles
  const uniqueTitles = Array.from(new Set(attendanceRecords.map(record => record.streamTitle))).sort()

  // Filtered records based on state
  const filteredRecords = attendanceRecords.filter(record => {
    const recordDate = format(new Date(record.startTime), 'yyyy-MM-dd')
    const dateMatch = filterDate ? recordDate === filterDate : true
    const titleMatch = filterTitle ? record.streamTitle === filterTitle : true
    return dateMatch && titleMatch
  })
  
  // Pagination calculations
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage)
  const startIndex = (currentPage - 1) * recordsPerPage
  const endIndex = startIndex + recordsPerPage
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex)
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterDate, filterTitle])

  const updateUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      let embedUrl = url
      if (url.includes('youtube.com/watch?v=')) {
        const videoId = url.split('v=')[1].split('&')[0]
        embedUrl = `https://www.youtube.com/embed/${videoId}`
      } else if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1].split('?')[0]
        embedUrl = `https://www.youtube.com/embed/${videoId}`
      } else if (!url.includes('embed')) {
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

  const handleLogout = () => {
    localStorage.removeItem('adminAuth')
    router.push('/')
  }

  const exportToPDF = () => {
    const recordsToExport = filteredRecords.length > 0 ? filteredRecords : attendanceRecords
    
    const doc = new jsPDF()
    
    // Add title
    doc.setFontSize(18)
    doc.text('Attendance Records', 14, 20)
    
    // Add subtitle with church name
    doc.setFontSize(12)
    doc.text('Deeper Life Bible Church - Pontypridd Region', 14, 28)
    
    // Add export date
    doc.setFontSize(10)
    doc.text(`Generated on: ${format(new Date(), 'MMM dd, yyyy h:mm a')}`, 14, 35)
    
    // Prepare table data
    const tableData = recordsToExport.map((record, index) => [
      (index + 1).toString(),
      record.name,
      record.email,
      record.streamTitle,
      format(new Date(record.startTime), 'MMM dd, yyyy'),
    ])
    
    // Add table
    autoTable(doc, {
      head: [['S/N', 'Name', 'Email', 'Service', 'Date']],
      body: tableData,
      startY: 42,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] },
    })
    
    // Save the PDF
    doc.save(`attendance-records-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    
    toast({
      title: 'Export successful',
      description: `${recordsToExport.length} attendance records have been exported to PDF`,
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Deeper Life Bible Church - Pontypridd Region</p>
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
              Update YouTube Stream
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                ⚠️ No stream URL configured yet. Please set one above.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="text-primary" data-testid="icon-users" />
              <span data-testid="text-records-count">
                Attendance Records ({attendanceRecords.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingRecords ? (
              <p className="text-center py-8 text-muted-foreground" data-testid="text-loading-records">
                Loading attendance records...
              </p>
            ) : attendanceRecords.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground" data-testid="text-no-records">
                No attendance records yet
              </p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <Label htmlFor="filter-date">Filter by Date</Label>
                    <Input
                      id="filter-date"
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
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
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredRecords.length)} of {filteredRecords.length} {filterDate || filterTitle ? 'filtered' : ''} records
                  {(filterDate || filterTitle) && ` (${attendanceRecords.length} total)`}
                </div>
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">S/N</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
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
                          <TableCell>{record.email}</TableCell>
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
                
                {/* Pagination Controls */}
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
                          // Show first page, last page, current page, and pages around current
                          return page === 1 || 
                                 page === totalPages || 
                                 Math.abs(page - currentPage) <= 1
                        })
                        .map((page, index, array) => {
                          // Add ellipsis if there's a gap
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

        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100" data-testid="text-setup-title">
              Setup Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2" data-testid="list-setup-instructions">
              <li data-testid="instruction-password">
                • Default admin password: <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded-sm">admin123</code>
              </li>
              <li data-testid="instruction-stream-url">
                • For permanent live stream, use: <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded-sm">CHANNEL_ID/live</code>
              </li>
              <li data-testid="instruction-tracking">• Attendance is recorded when users close the tab or leave</li>
              <li data-testid="instruction-export">• Export data to PDF for record keeping and printing</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
