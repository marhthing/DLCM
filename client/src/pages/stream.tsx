import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Clock, CheckCircle, AlertCircle, Timer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { StreamSettings } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

export default function Stream() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<{ name: string; email: string; startTime: number; lastStreamSessionId?: string } | null>(null);
  const [isStreamLive, setIsStreamLive] = useState<boolean>(false);
  const [checkingLiveStatus, setCheckingLiveStatus] = useState<boolean>(true);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamSessionIdRef = useRef<string>("");
  const currentStartTimeRef = useRef<number>(0); // Track the actual start time for current session

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

  // Check if the stream is live using YouTube oEmbed API
  useEffect(() => {
    const checkIfStreamIsLive = async () => {
      if (!streamSettings?.youtubeUrl) return;
      
      try {
        setCheckingLiveStatus(true);
        
        // Extract video ID from YouTube URL
        const videoId = extractVideoId(streamSettings.youtubeUrl);
        if (!videoId) {
          setIsStreamLive(false);
          setCheckingLiveStatus(false);
          return;
        }

        // Use YouTube oEmbed to check if video exists and is accessible
        const response = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );
        
        if (response.ok) {
          // Video exists, assume it's live if it's configured in settings
          setIsStreamLive(true);
        } else {
          setIsStreamLive(false);
        }
      } catch (error) {
        console.error('Error checking stream status:', error);
        setIsStreamLive(false);
      } finally {
        setCheckingLiveStatus(false);
      }
    };

    checkIfStreamIsLive();
    
    // Recheck every 2 minutes
    const interval = setInterval(checkIfStreamIsLive, 120000);
    return () => clearInterval(interval);
  }, [streamSettings?.youtubeUrl]);

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
      /youtube\.com\/live\/([^&\s?]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // Generate stream session ID from video ID + date
  const generateStreamSessionId = (videoId: string): string => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    return `${videoId}_${today}`;
  };

  // Send heartbeat to update attendance with explicit parameters to avoid closure issues
  const sendHeartbeat = async (params?: { name: string; email: string; streamSessionId: string; startTime: number }) => {
    if (!isStreamLive) return;

    // Use provided params or fallback to current values
    const name = params?.name || user?.name;
    const email = params?.email || user?.email;
    const sessionId = params?.streamSessionId || streamSessionIdRef.current;
    const startTime = params?.startTime || currentStartTimeRef.current || user?.startTime || Date.now();

    if (!name || !email || !sessionId) {
      console.warn('Heartbeat skipped - missing required data');
      return;
    }

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    
    try {
      await apiRequest("/api/attendance/heartbeat", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          streamSessionId: sessionId,
          startTime: new Date(startTime).toISOString(),
          durationSeconds,
        }),
      });
      console.log(`Heartbeat sent successfully - startTime: ${new Date(startTime).toISOString()}, duration: ${durationSeconds}s`);
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  };

  // Set up heartbeat system and timer
  useEffect(() => {
    if (!user || !isStreamLive || !streamSettings?.youtubeUrl) return;

    // Generate stream session ID
    const videoId = extractVideoId(streamSettings.youtubeUrl);
    if (!videoId) return;

    const newStreamSessionId = generateStreamSessionId(videoId);
    
    // Check if this is a new stream session
    const isNewSession = !streamSessionIdRef.current || 
                         streamSessionIdRef.current !== newStreamSessionId || 
                         (user.lastStreamSessionId && user.lastStreamSessionId !== newStreamSessionId);
    
    let sessionStartTime: number;
    const heartbeatParams = {
      name: user.name,
      email: user.email,
      streamSessionId: newStreamSessionId,
      startTime: 0, // Will be set below
    };
    
    if (isNewSession) {
      // New stream detected - reset startTime to now
      const now = Date.now();
      sessionStartTime = now;
      currentStartTimeRef.current = now;
      heartbeatParams.startTime = now;
      const updatedUser = { ...user, startTime: now, lastStreamSessionId: newStreamSessionId };
      setUser(updatedUser);
      localStorage.setItem("churchUser", JSON.stringify(updatedUser));
      console.log(`New stream session detected (${newStreamSessionId}), reset startTime to ${new Date(now).toISOString()}`);
    } else {
      // Same session, use existing startTime
      sessionStartTime = user.startTime;
      currentStartTimeRef.current = user.startTime;
      heartbeatParams.startTime = user.startTime;
    }
    
    streamSessionIdRef.current = newStreamSessionId;

    // Send initial heartbeat immediately with explicit parameters (before any async operations)
    sendHeartbeat(heartbeatParams);

    // Update elapsed time every second
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - currentStartTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    // Send heartbeat every 30 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat(); // Uses current refs, not closure
    }, 30000);

    // Cleanup function
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [user, isStreamLive, streamSettings?.youtubeUrl]);

  // Send final heartbeat with sendBeacon for reliability
  const sendFinalHeartbeat = () => {
    if (!user || !isStreamLive || !streamSessionIdRef.current) return;

    // Use the current session's actual start time from ref
    const startTime = currentStartTimeRef.current || user.startTime || Date.now();
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    const data = {
      name: user.name,
      email: user.email,
      streamSessionId: streamSessionIdRef.current,
      startTime: new Date(startTime).toISOString(),
      durationSeconds,
    };

    // Use sendBeacon for reliable data sending on page unload
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    navigator.sendBeacon("/api/attendance/heartbeat", blob);
  };

  // Handle visibility change and page unload
  useEffect(() => {
    if (!user || !isStreamLive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, send final heartbeat
        sendFinalHeartbeat();
      }
    };

    const handleBeforeUnload = () => {
      // Send final heartbeat using sendBeacon
      sendFinalHeartbeat();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      // Send final heartbeat when component unmounts
      sendFinalHeartbeat();
    };
  }, [user, isStreamLive, streamSettings?.youtubeUrl]);

  // Format time helper
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

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
            {isStreamLive ? (
              <CheckCircle 
                className="text-green-500" 
                size={24} 
                data-testid="icon-attendance-active" 
              />
            ) : (
              <AlertCircle 
                className="text-yellow-500" 
                size={24} 
                data-testid="icon-stream-offline" 
              />
            )}
            <div>
              <h2 className="text-white font-semibold" data-testid="text-user-name">
                {user.name}
              </h2>
              <p className="text-gray-400 text-sm" data-testid="text-user-email">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Clock size={20} className="text-blue-400" data-testid="icon-attendance-clock" />
              {checkingLiveStatus ? (
                <span className="text-sm text-gray-400" data-testid="text-checking-status">
                  Checking stream status...
                </span>
              ) : isStreamLive ? (
                <span className="text-sm text-green-400" data-testid="text-attendance-status">
                  Attendance being recorded
                </span>
              ) : (
                <span className="text-sm text-yellow-400" data-testid="text-stream-offline">
                  Stream offline - Attendance not recorded
                </span>
              )}
            </div>
            {isStreamLive && (
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
                <div className="flex items-center gap-1" data-testid="container-start-time">
                  <span className="text-gray-500">Started:</span>
                  <span className="font-medium" data-testid="text-start-time">
                    {format(user.startTime, 'h:mm a')}
                  </span>
                </div>
                <div className="flex items-center gap-1" data-testid="container-duration">
                  <Timer size={16} className="text-blue-400" />
                  <span className="text-gray-500">Watching:</span>
                  <span className="font-medium text-blue-400" data-testid="text-duration">
                    {formatDuration(elapsedSeconds)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="aspect-video bg-black rounded-md overflow-hidden shadow-2xl">
          <iframe
            data-testid="iframe-youtube-stream"
            width="100%"
            height="100%"
            src={`${youtubeUrl}${youtubeUrl.includes('?') ? '&' : '?'}autoplay=1&mute=0`}
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
            {isStreamLive ? (
              <p className="text-gray-400" data-testid="text-instructions">
                Your attendance is being tracked. Please keep this window open during the service.
                You can minimize but don't close the tab.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-yellow-400 font-medium" data-testid="text-stream-not-live">
                  The stream is not currently live.
                </p>
                <p className="text-gray-400 text-sm">
                  Your attendance will only be recorded when the live stream is active.
                  You can stay on this page and attendance will automatically start recording when the stream goes live.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
