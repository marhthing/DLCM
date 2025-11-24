import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Youtube, Users, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AttendanceRecord, StreamSettings } from "@shared/schema";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [newYoutubeUrl, setNewYoutubeUrl] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const isAdmin = localStorage.getItem("adminAuth");
    if (!isAdmin) {
      setLocation("/admin/login");
    }
  }, [setLocation]);

  const { data: attendanceRecords = [], isLoading: isLoadingRecords } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance/records"],
  });

  const { data: streamSettings } = useQuery<StreamSettings>({
    queryKey: ["/api/stream/settings"],
  });

  const updateUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      let embedUrl = url;
      if (url.includes("youtube.com/watch?v=")) {
        const videoId = url.split("v=")[1].split("&")[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else if (url.includes("youtu.be/")) {
        const videoId = url.split("youtu.be/")[1].split("?")[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else if (!url.includes("embed")) {
        embedUrl = `https://www.youtube.com/embed/${url}`;
      }
      return apiRequest("PUT", "/api/stream/settings", { url: embedUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stream/settings"] });
      toast({
        title: "Success",
        description: "YouTube link updated successfully!",
      });
      setNewYoutubeUrl("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update YouTube link.",
        variant: "destructive",
      });
    },
  });

  const handleUpdateUrl = () => {
    if (newYoutubeUrl) {
      updateUrlMutation.mutate(newYoutubeUrl);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminAuth");
    setLocation("/");
  };

  const exportToCSV = () => {
    const headers = ["Name", "Email", "Date", "Time", "Duration"];
    const rows = attendanceRecords.map((r) => {
      const date = new Date(r.timestamp);
      const duration = `${Math.floor(r.durationSeconds / 60)} mins ${r.durationSeconds % 60} secs`;
      return [
        r.name,
        r.email,
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        duration,
      ];
    });

    let csv = headers.join(",") + "\n";
    rows.forEach((row) => {
      csv += row.join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Admin Dashboard</h1>
          <Button
            data-testid="button-logout"
            variant="link"
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
              {updateUrlMutation.isPending ? "Updating..." : "Update Stream URL"}
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
            <div className="flex flex-wrap justify-between items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <Users className="text-primary" data-testid="icon-users" />
                <span data-testid="text-records-count">
                  Attendance Records ({attendanceRecords.length})
                </span>
              </CardTitle>
              <Button
                data-testid="button-export-csv"
                onClick={exportToCSV}
                disabled={attendanceRecords.length === 0}
                variant="outline"
                size="sm"
              >
                <Download className="mr-2 h-4 w-4" data-testid="icon-download" />
                Export CSV
              </Button>
            </div>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead data-testid="header-name">Name</TableHead>
                      <TableHead data-testid="header-email">Email</TableHead>
                      <TableHead data-testid="header-date">Date</TableHead>
                      <TableHead data-testid="header-time">Time</TableHead>
                      <TableHead data-testid="header-duration">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.map((record) => {
                      const date = new Date(record.timestamp);
                      const duration = `${Math.floor(record.durationSeconds / 60)} mins ${record.durationSeconds % 60} secs`;
                      return (
                        <TableRow key={record.id} data-testid={`row-attendance-${record.id}`}>
                          <TableCell data-testid={`cell-name-${record.id}`}>{record.name}</TableCell>
                          <TableCell data-testid={`cell-email-${record.id}`}>{record.email}</TableCell>
                          <TableCell data-testid={`cell-date-${record.id}`}>{date.toLocaleDateString()}</TableCell>
                          <TableCell data-testid={`cell-time-${record.id}`}>{date.toLocaleTimeString()}</TableCell>
                          <TableCell data-testid={`cell-duration-${record.id}`}>{duration}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
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
              <li data-testid="instruction-export">• Export data to CSV to upload to Google Sheets</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
