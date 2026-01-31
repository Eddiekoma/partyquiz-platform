/**
 * YouTube IFrame Player Component
 * Plays video segments with controlled start/end times
 * Uses YouTube IFrame API
 * @see https://developers.google.com/youtube/iframe_api_reference
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { buildYouTubeEmbedUrl } from "@partyquiz/shared";

interface YouTubePlayerProps {
  videoId: string;
  startSeconds?: number;
  endSeconds?: number;
  autoplay?: boolean;
  controls?: boolean;
  onReady?: () => void;
  onEnd?: () => void;
  className?: string;
}

// Global flag to track if API is loaded
let apiLoaded = false;
let apiLoading = false;
const apiLoadCallbacks: (() => void)[] = [];

export function YouTubePlayer({
  videoId,
  startSeconds,
  endSeconds,
  autoplay = false,
  controls = false,
  onReady,
  onEnd,
  className = "",
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Load YouTube IFrame API if not already loaded
    const loadYouTubeAPI = () => {
      if (apiLoaded) {
        initializePlayer();
        return;
      }

      if (apiLoading) {
        // API is currently loading, wait for it
        apiLoadCallbacks.push(initializePlayer);
        return;
      }

      // Start loading the API
      apiLoading = true;

      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      // YouTube API calls this function when ready
      (window as any).onYouTubeIframeAPIReady = () => {
        apiLoaded = true;
        apiLoading = false;
        
        // Call all waiting callbacks
        apiLoadCallbacks.forEach((cb) => cb());
        apiLoadCallbacks.length = 0;
      };
    };

    const initializePlayer = () => {
      if (!containerRef.current || playerRef.current) return;

      const YT = (window as any).YT;
      if (!YT || !YT.Player) return;

      // Create player
      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          controls: controls ? 1 : 0,
          modestbranding: 1,
          rel: 0, // No related videos
          fs: 0, // No fullscreen
          disablekb: 1, // Disable keyboard controls
          start: startSeconds,
          end: endSeconds,
        },
        events: {
          onReady: (event: any) => {
            setIsReady(true);
            onReady?.();
            
            // Auto-play if requested
            if (autoplay) {
              event.target.playVideo();
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED === 0
            if (event.data === 0) {
              onEnd?.();
            }
          },
        },
      });
    };

    loadYouTubeAPI();

    // Cleanup
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore errors on cleanup
        }
        playerRef.current = null;
      }
    };
  }, [videoId, startSeconds, endSeconds, autoplay, controls, onReady, onEnd]);

  // Public methods for external control
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    // Expose player instance for parent component
    (containerRef.current as any)._ytPlayer = playerRef.current;
  }, [isReady]);

  return (
    <div className={`youtube-player-container ${className}`}>
      <div ref={containerRef} className="youtube-player" />
      
      <style jsx>{`
        .youtube-player-container {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%; /* 16:9 aspect ratio */
          overflow: hidden;
          background: #000;
          border-radius: 8px;
        }
        
        .youtube-player {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        
        .youtube-player :global(iframe) {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
      `}</style>
    </div>
  );
}

/**
 * Helper functions to control player from outside
 */
export const YouTubePlayerControls = {
  play: (containerElement: HTMLElement) => {
    const player = (containerElement as any)._ytPlayer;
    if (player && player.playVideo) {
      player.playVideo();
    }
  },
  
  pause: (containerElement: HTMLElement) => {
    const player = (containerElement as any)._ytPlayer;
    if (player && player.pauseVideo) {
      player.pauseVideo();
    }
  },
  
  seekTo: (containerElement: HTMLElement, seconds: number) => {
    const player = (containerElement as any)._ytPlayer;
    if (player && player.seekTo) {
      player.seekTo(seconds, true);
    }
  },
  
  getCurrentTime: (containerElement: HTMLElement): number => {
    const player = (containerElement as any)._ytPlayer;
    if (player && player.getCurrentTime) {
      return player.getCurrentTime();
    }
    return 0;
  },
};
