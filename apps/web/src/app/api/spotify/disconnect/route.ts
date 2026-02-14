/**
 * Spotify Disconnect - Clear stored Spotify tokens
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Clear Spotify tokens from database
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        spotifyAccessToken: null,
        spotifyRefreshToken: null,
        spotifyTokenExpiry: null,
      },
    });

    return NextResponse.json({ success: true, message: "Spotify disconnected" });
  } catch (error) {
    console.error("Spotify disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Spotify" },
      { status: 500 }
    );
  }
}
