import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Clock, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { StreamSettings } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Stream() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<{ name: string; email: string; startTime: number } | null>(null);
  const attendanceRecordedRef = useRef(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("churchUser");
    if (!storedUser) {
      setLocation("/");
      return;
    }
    setUser(JSON.parse(storedUser));
  }, [setLocation]);

  const { data: streamSettings } = useQuery<StreamSettings>({
    queryKey: ["/api/stream/settings"],
  });

  const recordAttendance = (userData: { name: string; email: string; startTime: number }) => {
    if (attendanceRecordedRef.current) return;
    attendanceRecordedRef.current = true;

    const duration = Math.floor((Date.now() - userData.startTime) / 1000);
    const data = {
      name: userData.name,
      email: userData.email,
      startTime: new Date(userData.startTime).toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: duration,
    };

    // Use sendBeacon for reliable data sending
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    navigator.sendBeacon("/api/attendance/record", blob);
    
    localStorage.removeItem("churchUser");
  };

  // Handle both beforeunload and component unmount
  useEffect(() => {
    if (!user) return;

    // Handle beforeunload (tab close, browser close, refresh)
    const handleBeforeUnload = () => {
      recordAttendance(user);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup function runs when component unmounts (SPA navigation or any other reason)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Record attendance when navigating away or unmounting
      recordAttendance(user);
    };
  }, [user]);

  if (!user) return null;

  const youtubeUrl = streamSettings?.youtubeUrl;

  if (!youtubeUrl) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Stream Not Configured</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The administrator hasn't set up the stream URL yet. Please check back later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-black">
      <div className="bg-gray-800 dark:bg-gray-950 border-b border-gray-700 dark:border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle 
              className="text-green-500" 
              size={24} 
              data-testid="icon-attendance-active" 
            />
            <div>
              <h2 className="text-white font-semibold" data-testid="text-user-name">
                {user.name}
              </h2>
              <p className="text-gray-400 text-sm" data-testid="text-user-email">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Clock size={20} data-testid="icon-attendance-clock" />
            <span className="text-sm" data-testid="text-attendance-status">
              Attendance being recorded
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="aspect-video bg-black rounded-md overflow-hidden shadow-2xl">
          <iframe
            data-testid="iframe-youtube-stream"
            width="100%"
            height="100%"
            src={youtubeUrl}
            title="Church Live Stream"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>

        <Card className="mt-6 bg-gray-800 dark:bg-gray-950 border-gray-700 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-xl" data-testid="text-welcome-title">
              Welcome to the Service!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400" data-testid="text-instructions">
              Your attendance is being tracked. Please keep this window open during the service.
              You can minimize but don't close the tab.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
