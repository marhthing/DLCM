import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Clock, CheckCircle, AlertCircle, Timer, Users } from "lucide-react";
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
  const [iframeLoading, setIframeLoading] = useState<boolean>(true);
  const [activeViewersCount, setActiveViewersCount] = useState<number>(0);
  const [streamTitle, setStreamTitle] = useState<string>("");
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
          const data = await response.json();
          // Set stream title from YouTube metadata
          setStreamTitle(data.title || "Live Stream");
          setIsStreamLive(true);
        } else {
          setStreamTitle("");
          setIsStreamLive(false);
        }
      } catch (error) {
        console.error('Error checking stream status:', error);
        setStreamTitle("");
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

  // Generate stream session ID from video ID + date + stream title
  const generateStreamSessionId = (videoId: string, title: string): string => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    // Sanitize title to create a clean session ID
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    return `${videoId}_${today}_${sanitizedTitle}`;
  };

  // Send heartbeat to update attendance with explicit parameters to avoid closure issues
  const sendHeartbeat = async (params?: { name: string; email: string; streamSessionId: string; streamTitle: string; startTime: number }) => {
    if (!isStreamLive) return;

    // Use provided params or fallback to current values
    const name = params?.name || user?.name;
    const email = params?.email || user?.email;
    const sessionId = params?.streamSessionId || streamSessionIdRef.current;
    const title = params?.streamTitle || streamTitle || 'Live Stream';
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
          streamTitle: title,
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

    const newStreamSessionId = generateStreamSessionId(videoId, streamTitle || 'LiveStream');
    
    // Check if this is a new stream session
    const isNewSession = !streamSessionIdRef.current || 
                         streamSessionIdRef.current !== newStreamSessionId || 
                         (user.lastStreamSessionId && user.lastStreamSessionId !== newStreamSessionId);
    
    let sessionStartTime: number;
    const heartbeatParams = {
      name: user.name,
      email: user.email,
      streamSessionId: newStreamSessionId,
      streamTitle: streamTitle || 'Live Stream',
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
      streamTitle: streamTitle || 'Live Stream',
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

  // Fetch active viewers count periodically
  useEffect(() => {
    if (!isStreamLive) {
      setActiveViewersCount(0);
      return;
    }

    const fetchActiveViewers = async () => {
      try {
        const response = await fetch("/api/attendance/active-count");
        if (response.ok) {
          const data = await response.json();
          setActiveViewersCount(data.count);
        }
      } catch (error) {
        console.error('Error fetching active viewers:', error);
      }
    };

    // Fetch immediately
    fetchActiveViewers();

    // Then fetch every 10 seconds
    const interval = setInterval(fetchActiveViewers, 10000);
    return () => clearInterval(interval);
  }, [isStreamLive]);

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
      <div className="bg-gray-800 dark:bg-gray-950 border-b border-gray-700 dark:border-gray-800 px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 pb-3 border-b border-gray-700">
            <img 
              src="https://deeperlifeclapham.org/wp-content/uploads/2024/02/Deeper-life-logo-final-outlines-.png" 
              alt="Deeper Life Bible Church Logo" 
              className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 object-contain shrink-0"
            />
            <div className="text-center">
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-white">
                Deeper Life Bible Church
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-300">
                Pontypridd Region
              </p>
            </div>
          </div>
          
          {streamTitle && (
            <div className="flex items-center justify-center gap-2 pb-2 border-b border-gray-700">
              <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-white text-center px-2" data-testid="text-stream-title">
                {streamTitle}
              </h2>
            </div>
          )}
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 lg:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto">
              {isStreamLive ? (
                <CheckCircle 
                  className="text-green-500 shrink-0" 
                  size={20} 
                  data-testid="icon-attendance-active" 
                />
              ) : (
                <AlertCircle 
                  className="text-yellow-500 shrink-0" 
                  size={20} 
                  data-testid="icon-stream-offline" 
                />
              )}
              <div className="min-w-0">
                <h2 className="text-white font-semibold text-sm sm:text-base truncate" data-testid="text-user-name">
                  {user.name}
                </h2>
                <p className="text-gray-400 text-xs sm:text-sm truncate" data-testid="text-user-email">
                  {user.email}
                </p>
              </div>
            </div>
          <div className="flex flex-col gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-blue-400 shrink-0" data-testid="icon-attendance-clock" />
              {checkingLiveStatus ? (
                <span className="text-xs sm:text-sm text-gray-400" data-testid="text-checking-status">
                  Checking stream status...
                </span>
              ) : isStreamLive ? (
                <span className="text-xs sm:text-sm text-green-400" data-testid="text-attendance-status">
                  Attendance being recorded
                </span>
              ) : (
                <span className="text-xs sm:text-sm text-yellow-400" data-testid="text-stream-offline">
                  Stream offline - Attendance not recorded
                </span>
              )}
            </div>
            {isStreamLive && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-300">
                <div className="flex items-center gap-1" data-testid="container-active-viewers">
                  <Users size={14} className="text-green-400" />
                  <span className="text-gray-500">Active:</span>
                  <span className="font-medium text-green-400" data-testid="text-active-viewers">
                    {activeViewersCount}
                  </span>
                </div>
                <div className="flex items-center gap-1" data-testid="container-start-time">
                  <span className="text-gray-500">Started:</span>
                  <span className="font-medium" data-testid="text-start-time">
                    {format(user.startTime, 'h:mm a')}
                  </span>
                </div>
                <div className="flex items-center gap-1" data-testid="container-duration">
                  <Timer size={14} className="text-blue-400" />
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
      </div>

      <div className="max-w-7xl mx-auto p-2 sm:p-4 md:p-6">
        <div className="aspect-video bg-black rounded-sm sm:rounded-md overflow-hidden shadow-lg sm:shadow-2xl relative">
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
              <div className="text-center">
                <div className="inline-block h-8 w-8 sm:h-12 sm:w-12 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
                <p className="mt-2 sm:mt-4 text-white text-xs sm:text-sm">Loading stream...</p>
              </div>
            </div>
          )}
          <iframe
            data-testid="iframe-youtube-stream"
            width="100%"
            height="100%"
            src={`${youtubeUrl}${youtubeUrl.includes('?') ? '&' : '?'}autoplay=1&mute=0&fs=1&modestbranding=1`}
            title="Church Live Stream"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            webkitallowfullscreen="true"
            mozallowfullscreen="true"
            onLoad={() => setIframeLoading(false)}
            className="w-full h-full"
          ></iframe>
        </div>

        <Card className="mt-3 sm:mt-4 md:mt-6 bg-gray-800 dark:bg-gray-950 border-gray-700 dark:border-gray-800">
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="text-white text-sm sm:text-base md:text-lg lg:text-xl" data-testid="text-welcome-title">
              Welcome to Deeper Life Bible Church - Pontypridd Region
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6">
            {isStreamLive ? (
              <p className="text-gray-400 text-xs sm:text-sm md:text-base" data-testid="text-instructions">
                Your attendance is being tracked. Please keep this window open during the service.
                You can minimize but don't close the tab.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-yellow-400 font-medium text-xs sm:text-sm md:text-base" data-testid="text-stream-not-live">
                  The stream is not currently live.
                </p>
                <p className="text-gray-400 text-xs sm:text-sm">
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
