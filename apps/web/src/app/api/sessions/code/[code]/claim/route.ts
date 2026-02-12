import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/sessions/code/[code]/claim
 * Claim an existing player with a device ID
 * Used when player selects "Who are you?" from the list
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  try {
    const body = await request.json();
    const { playerId, deviceIdHash } = body;

    if (!playerId || !deviceIdHash) {
      return NextResponse.json(
        { error: "Player ID and Device ID are required" },
        { status: 400 }
      );
    }

    // Find session
    const session = await prisma.liveSession.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.status === "ENDED") {
      return NextResponse.json(
        { error: "This session has ended" },
        { status: 400 }
      );
    }

    // Find the player (including left players who can rejoin)
    const player = await prisma.livePlayer.findFirst({
      where: {
        id: playerId,
        sessionId: session.id,
      },
      include: {
        _count: {
          select: { answers: true },
        },
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    // If player left and has no answers, they can't rejoin (didn't participate)
    if (player.leftAt && player._count.answers === 0) {
      return NextResponse.json(
        { error: "This player slot is no longer available" },
        { status: 410 }
      );
    }

    // Check if player is already claimed by another device (only for active players)
    // Left players can be reclaimed by any device
    if (!player.leftAt && player.deviceIdHash && player.deviceIdHash !== deviceIdHash) {
      return NextResponse.json(
        { error: "This player has already been claimed by another device" },
        { status: 409 }
      );
    }

    // Check if this device is already bound to another player in this session
    const existingPlayer = await prisma.livePlayer.findFirst({
      where: {
        sessionId: session.id,
        deviceIdHash,
        leftAt: null,
        id: { not: playerId },
      },
    });

    if (existingPlayer) {
      return NextResponse.json(
        { error: `This device is already linked to ${existingPlayer.name}` },
        { status: 409 }
      );
    }

    // Claim the player (and reactivate if they had left)
    const updatedPlayer = await prisma.livePlayer.update({
      where: { id: player.id },
      data: {
        deviceIdHash,
        lastActiveAt: new Date(),
        leftAt: null, // Reactivate the player if they had left
      },
    });

    // Log if this was a rejoin
    if (player.leftAt) {
      console.log(`[CLAIM] Player ${player.name} rejoined session after leaving`);
    }

    return NextResponse.json({
      success: true,
      playerId: updatedPlayer.id,
      name: updatedPlayer.name,
      avatar: updatedPlayer.avatar,
      accessToken: updatedPlayer.accessToken,
      wasRejoined: !!player.leftAt, // Let frontend know this was a rejoin
    });
  } catch (error) {
    console.error("[POST /api/sessions/code/[code]/claim] Error:", error);
    return NextResponse.json(
      { error: "Error claiming player" },
      { status: 500 }
    );
  }
}
