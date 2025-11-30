
// YouTube API helper to check if a video is a live stream
export async function checkIfLive(videoId: string): Promise<boolean> {
  try {
    // Use YouTube's oEmbed API (no API key required)
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    )
    
    if (!response.ok) {
      console.warn('Failed to fetch YouTube video info')
      return true // Default to true (live) if we can't check
    }

    const data = await response.json()
    
    // Check if the title contains indicators that it's recorded/VOD
    const title = data.title?.toLowerCase() || ''
    const isRecorded = 
      title.includes('replay') || 
      title.includes('recorded') || 
      title.includes('vod') ||
      title.includes('archive')
    
    // If we detect recorded indicators, mark as not live
    if (isRecorded) {
      return false
    }
    
    // Default to live - we can't reliably detect without YouTube API key
    // The player state monitoring will help catch when a live stream ends
    return true
  } catch (error) {
    console.error('Error checking if video is live:', error)
    return true // Default to true (live) if there's an error
  }
}

// Check live status periodically
export async function monitorLiveStatus(
  videoId: string, 
  onStatusChange: (isLive: boolean) => void,
  intervalMs: number = 60000 // Check every minute
): Promise<() => void> {
  let lastStatus = await checkIfLive(videoId)
  onStatusChange(lastStatus)
  
  const interval = setInterval(async () => {
    const currentStatus = await checkIfLive(videoId)
    if (currentStatus !== lastStatus) {
      lastStatus = currentStatus
      onStatusChange(currentStatus)
    }
  }, intervalMs)
  
  // Return cleanup function
  return () => clearInterval(interval)
}
