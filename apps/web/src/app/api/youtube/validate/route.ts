/**
 * YouTube Video Validation API
 * Extract video ID from URL and fetch metadata using oEmbed (no API key needed!)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  extractYouTubeVideoId,
  isValidYouTubeVideoId,
  getYouTubeVideoInfo,
} from "@partyquiz/shared";

/**
 * POST /api/youtube/validate
 * Body: { url: string }
 * Returns video metadata if valid
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid URL" },
        { status: 400 }
      );
    }

    // Extract video ID
    const videoId = extractYouTubeVideoId(url);
    
    if (!videoId || !isValidYouTubeVideoId(videoId)) {
      return NextResponse.json(
        { error: "Invalid YouTube URL or video ID" },
        { status: 400 }
      );
    }

    // Fetch video metadata using oEmbed (no API key needed!)
    const videoInfo = await getYouTubeVideoInfo(videoId);
    
    if (!videoInfo) {
      return NextResponse.json(
        { error: "Video not found or is private" },
        { status: 404 }
      );
    }

    // Return formatted video data
    return NextResponse.json({
      videoId: videoInfo.videoId,
      title: videoInfo.title,
      channelName: videoInfo.author_name,
      channelUrl: videoInfo.author_url,
      thumbnail: {
        url: videoInfo.thumbnail_url,
        width: videoInfo.thumbnail_width,
        height: videoInfo.thumbnail_height,
      },
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
    });
  } catch (error) {
    console.error("YouTube validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate YouTube video" },
      { status: 500 }
    );
  }
}
