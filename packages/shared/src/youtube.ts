/**
 * YouTube utility functions
 * Extract video IDs, validate URLs, format timestamps
 */

/**
 * Extract YouTube video ID from various URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    
    // Standard watch URL: youtube.com/watch?v=...
    if (parsedUrl.hostname.includes("youtube.com") && parsedUrl.searchParams.has("v")) {
      return parsedUrl.searchParams.get("v");
    }
    
    // Short URL: youtu.be/...
    if (parsedUrl.hostname === "youtu.be") {
      return parsedUrl.pathname.substring(1).split("/")[0];
    }
    
    // Embed URL: youtube.com/embed/...
    if (parsedUrl.pathname.startsWith("/embed/")) {
      return parsedUrl.pathname.split("/")[2];
    }
    
    // Old format: youtube.com/v/...
    if (parsedUrl.pathname.startsWith("/v/")) {
      return parsedUrl.pathname.split("/")[2];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate YouTube video ID format
 * YouTube IDs are 11 characters: alphanumeric + _ and -
 */
export function isValidYouTubeVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/**
 * Build YouTube embed URL with player parameters
 */
export function buildYouTubeEmbedUrl(params: {
  videoId: string;
  startSeconds?: number;
  endSeconds?: number;
  autoplay?: boolean;
  controls?: boolean;
  modestbranding?: boolean;
}): string {
  const {
    videoId,
    startSeconds,
    endSeconds,
    autoplay = false,
    controls = false,
    modestbranding = true,
  } = params;

  const url = new URL(`https://www.youtube.com/embed/${videoId}`);
  
  // Player parameters
  url.searchParams.set("autoplay", autoplay ? "1" : "0");
  url.searchParams.set("controls", controls ? "1" : "0");
  url.searchParams.set("modestbranding", modestbranding ? "1" : "0");
  url.searchParams.set("rel", "0"); // Don't show related videos
  url.searchParams.set("fs", "0"); // No fullscreen button
  url.searchParams.set("disablekb", "1"); // Disable keyboard controls
  
  // Segment parameters
  if (startSeconds !== undefined) {
    url.searchParams.set("start", Math.floor(startSeconds).toString());
  }
  
  if (endSeconds !== undefined) {
    url.searchParams.set("end", Math.floor(endSeconds).toString());
  }

  return url.toString();
}

/**
 * Format seconds to MM:SS
 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Parse timestamp string (MM:SS or M:SS or SS) to seconds
 */
export function parseTimestamp(timestamp: string): number | null {
  const parts = timestamp.trim().split(":");
  
  if (parts.length === 1) {
    // Just seconds: "45"
    const seconds = parseInt(parts[0], 10);
    return isNaN(seconds) ? null : seconds;
  }
  
  if (parts.length === 2) {
    // MM:SS format
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    
    if (isNaN(mins) || isNaN(secs) || secs >= 60) {
      return null;
    }
    
    return mins * 60 + secs;
  }
  
  return null;
}

/**
 * YouTube video metadata (from oEmbed API - no API key needed!)
 */
export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  author_name: string; // Channel name
  author_url: string; // Channel URL
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  html: string; // Embed HTML
}

/**
 * Get video metadata using YouTube oEmbed API (no API key required!)
 * @see https://oembed.com/
 */
export async function getYouTubeVideoInfo(videoId: string): Promise<YouTubeVideoInfo | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return null; // Video not found or private
    }
    
    const data = (await response.json()) as {
      title: string;
      author_name: string;
      author_url: string;
      thumbnail_url: string;
      thumbnail_width: number;
      thumbnail_height: number;
      html: string;
    };
    
    return {
      videoId,
      title: data.title,
      author_name: data.author_name,
      author_url: data.author_url,
      thumbnail_url: data.thumbnail_url,
      thumbnail_width: data.thumbnail_width,
      thumbnail_height: data.thumbnail_height,
      html: data.html,
    };
  } catch {
    return null;
  }
}
