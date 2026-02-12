import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/sessions/player/[token]
 * Validate player access token and return player + session info
 * Used for permanent player links: /play/[code]?player=[token]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const player = await prisma.livePlayer.findUnique({
      where: { accessToken: token },
      include: {
        session: {
          select: {
            id: true,
            code: true,
            status: true,
            quiz: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: "Invalid player link" },
        { status: 404 }
      );
    }

    if (player.session.status === "ENDED") {
      return NextResponse.json(
        { error: "This session has ended" },
        { status: 400 }
      );
    }

    // Update last active
    await prisma.livePlayer.update({
      where: { id: player.id },
      data: { 
        lastActiveAt: new Date(),
        leftAt: null, // Re-activate if they left
      },
    });

    return NextResponse.json({
      player: {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        accessToken: player.accessToken,
      },
      session: {
        id: player.session.id,
        code: player.session.code,
        status: player.session.status,
        quizTitle: player.session.quiz.title,
      },
    });
  } catch (error) {
    console.error("[GET /api/sessions/player/[token]] Error:", error);
    return NextResponse.json(
      { error: "Error validating player" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions/player/[token]/claim
 * Claim a player with a device ID (bind device to player)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const body = await request.json();
    const { deviceIdHash } = body;

    if (!deviceIdHash) {
      return NextResponse.json(
        { error: "Device ID is required" },
        { status: 400 }
      );
    }

    const player = await prisma.livePlayer.findUnique({
      where: { accessToken: token },
      include: {
        session: true,
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: "Invalid player link" },
        { status: 404 }
      );
    }

    if (player.session.status === "ENDED") {
      return NextResponse.json(
        { error: "This session has ended" },
        { status: 400 }
      );
    }

    // Check if this device is already bound to another player in this session
    const existingPlayer = await prisma.livePlayer.findFirst({
      where: {
        sessionId: player.sessionId,
        deviceIdHash,
        leftAt: null,
        id: { not: player.id },
      },
    });

    if (existingPlayer) {
      return NextResponse.json(
        { error: `This device is already linked to ${existingPlayer.name}` },
        { status: 409 }
      );
    }

    // Check if player is already claimed by another device
    if (player.deviceIdHash && player.deviceIdHash !== deviceIdHash) {
      return NextResponse.json(
        { error: "This player has already been claimed by another device" },
        { status: 409 }
      );
    }

    // Claim the player
    const updatedPlayer = await prisma.livePlayer.update({
      where: { id: player.id },
      data: {
        deviceIdHash,
        lastActiveAt: new Date(),
        leftAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      player: {
        id: updatedPlayer.id,
        name: updatedPlayer.name,
        accessToken: updatedPlayer.accessToken,
      },
      sessionCode: player.session.code,
    });
  } catch (error) {
    console.error("[POST /api/sessions/player/[token]/claim] Error:", error);
    return NextResponse.json(
      { error: "Error claiming player" },
      { status: 500 }
    );
  }
}
