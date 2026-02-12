import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/sessions/code/[code]/players
 * Get available players for a session (for "Select who you are" UI)
 * Returns players who can be joined/rejoined:
 * - Active players (leftAt: null)
 * - Left players who have answered at least one question (can rejoin)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const deviceIdHash = request.headers.get("x-device-id") || null;

  try {
    // Find session with ALL players (including left ones)
    const session = await prisma.liveSession.findUnique({
      where: { code: code.toUpperCase() },
      select: {
        id: true,
        status: true,
        players: {
          select: {
            id: true,
            name: true,
            avatar: true,
            deviceIdHash: true,
            accessToken: true,
            leftAt: true,
            _count: {
              select: { answers: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "This session has been archived and can no longer be joined. The quiz was updated after this session was created." },
        { status: 410 }
      );
    }

    if (session.status === "ENDED") {
      return NextResponse.json(
        { error: "This session has ended" },
        { status: 400 }
      );
    }

    // Check if current device matches any player (including left ones with same device)
    let currentPlayer = null;
    if (deviceIdHash) {
      // Prioritize active players, but also match left players with same device
      currentPlayer = session.players.find(p => p.deviceIdHash === deviceIdHash && !p.leftAt) 
        || session.players.find(p => p.deviceIdHash === deviceIdHash);
    }

    // Filter and map players for the response
    // Include: active players OR left players who have answers (can rejoin)
    const players = session.players
      .filter(p => {
        // Always include active players
        if (!p.leftAt) return true;
        // Include left players who have at least one answer (they can rejoin)
        if (p._count.answers > 0) return true;
        // Exclude left players with no answers (they didn't participate)
        return false;
      })
      .map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isYou: currentPlayer?.id === p.id,
        // Player is claimable if:
        // 1. They have no device hash (created by host for pre-registration)
        // 2. OR they match current device
        // 3. OR they are a "left" player (can be reclaimed)
        isAvailable: !p.deviceIdHash || p.deviceIdHash === deviceIdHash || !!p.leftAt,
        // Mark if this is a "left" player who can rejoin
        isLeft: !!p.leftAt,
        hasAnswers: p._count.answers > 0,
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
      { error: "Error fetching players" },
      { status: 500 }
    );
  }
}
