import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/sessions/code/[code]/players
 * Get available players for a session (for "Select who you are" UI)
 * Returns only players who are not currently claimed (no active device connection)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const deviceIdHash = request.headers.get("x-device-id") || null;

  try {
    // Find session
    const session = await prisma.liveSession.findUnique({
      where: { code: code.toUpperCase() },
      select: {
        id: true,
        status: true,
        players: {
          where: {
            leftAt: null, // Only active players
          },
          select: {
            id: true,
            name: true,
            avatar: true,
            deviceIdHash: true,
            accessToken: true,
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Sessie niet gevonden" },
        { status: 404 }
      );
    }

    if (session.status === "ENDED") {
      return NextResponse.json(
        { error: "Deze sessie is beëindigd" },
        { status: 400 }
      );
    }

    // Check if current device matches any player
    let currentPlayer = null;
    if (deviceIdHash) {
      currentPlayer = session.players.find(p => p.deviceIdHash === deviceIdHash);
    }

    // Return players with availability info
    // A player is "available" if they don't have a deviceIdHash set yet
    // or if they match the current device
    const players = session.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isYou: currentPlayer?.id === p.id,
      // Player is claimable if:
      // 1. They have no device hash (created by host for pre-registration)
      // 2. OR they match current device
      isAvailable: !p.deviceIdHash || p.deviceIdHash === deviceIdHash,
    }));

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      currentPlayer: currentPlayer ? {
        id: currentPlayer.id,
        name: currentPlayer.name,
        accessToken: currentPlayer.accessToken,
      } : null,
      players,
    });
  } catch (error) {
    console.error("[GET /api/sessions/code/[code]/players] Error:", error);
    return NextResponse.json(
      { error: "Fout bij ophalen spelers" },
      { status: 500 }
    );
  }
}
