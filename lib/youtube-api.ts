
// YouTube API helper to check if a video is a live stream
export async function checkIfLive(videoId: string): Promise<boolean> {
  try {
    // Use YouTube's oEmbed API (no API key required)
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    )
    
    if (!response.ok) {
      console.warn('Failed to fetch YouTube video info')
      return true // Default to true if we can't check
    }

    const data = await response.json()
    
    // Check if the title contains common live indicators
    const title = data.title?.toLowerCase() || ''
    const isLive = title.includes('live') || title.includes('streaming')
    
    // Additional check: Try to get more info from noembed
    const noembedResponse = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
    )
    
    if (noembedResponse.ok) {
      const noembedData = await noembedResponse.json()
      const author = noembedData.author_name?.toLowerCase() || ''
      const noembedTitle = noembedData.title?.toLowerCase() || ''
      
      // Check for "live" badge or indicators
      if (noembedTitle.includes('live now') || 
          noembedTitle.includes('live stream') ||
          author.includes('live')) {
        return true
      }
    }
    
    return isLive
  } catch (error) {
    console.error('Error checking if video is live:', error)
    return true // Default to true if there's an error
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
