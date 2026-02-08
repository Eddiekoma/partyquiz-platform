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
        { error: "Player ID en Device ID zijn vereist" },
        { status: 400 }
      );
    }

    // Find session
    const session = await prisma.liveSession.findUnique({
      where: { code: code.toUpperCase() },
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

    // Find the player
    const player = await prisma.livePlayer.findFirst({
      where: {
        id: playerId,
        sessionId: session.id,
        leftAt: null,
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: "Speler niet gevonden of niet meer actief" },
        { status: 404 }
      );
    }

    // Check if player is already claimed by another device
    if (player.deviceIdHash && player.deviceIdHash !== deviceIdHash) {
      return NextResponse.json(
        { error: "Deze speler is al geclaimd door een ander apparaat" },
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
        { error: `Dit apparaat is al gekoppeld aan ${existingPlayer.name}` },
        { status: 409 }
      );
    }

    // Claim the player
    const updatedPlayer = await prisma.livePlayer.update({
      where: { id: player.id },
      data: {
        deviceIdHash,
        lastActiveAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      playerId: updatedPlayer.id,
      name: updatedPlayer.name,
      avatar: updatedPlayer.avatar,
      accessToken: updatedPlayer.accessToken,
    });
  } catch (error) {
    console.error("[POST /api/sessions/code/[code]/claim] Error:", error);
    return NextResponse.json(
      { error: "Fout bij claimen speler" },
      { status: 500 }
    );
  }
}
