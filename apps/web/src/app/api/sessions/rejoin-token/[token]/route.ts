import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const redis = await getRedis();
    
    // Get player ID from Redis
    const playerId = await redis.get(`rejoin:${token}`);

    if (!playerId) {
      return NextResponse.json(
        { error: "Token is verlopen of ongeldig" },
        { status: 404 }
      );
    }

    // Get player info from database
    const player = await prisma.livePlayer.findUnique({
      where: { id: playerId },
      include: {
        session: true,
      },
    });

    if (!player) {
      // Clean up invalid token
      await redis.del(`rejoin:${token}`);
      return NextResponse.json(
        { error: "Speler niet gevonden" },
        { status: 404 }
      );
    }

    if (player.session.status === "ENDED") {
      // Clean up token
      await redis.del(`rejoin:${token}`);
      return NextResponse.json(
        { error: "Deze sessie is al beëindigd" },
        { status: 400 }
      );
    }

    // Delete the token after use (single use)
    await redis.del(`rejoin:${token}`);

    // Re-activate player if they were marked as left
    if (player.leftAt) {
      await prisma.livePlayer.update({
        where: { id: playerId },
        data: { leftAt: null },
      });
    }

    return NextResponse.json({
      playerId: player.id,
      playerName: player.name,
      avatar: player.avatar,
      sessionCode: player.session.code,
      sessionStatus: player.session.status,
    });
  } catch (error) {
    console.error("Error validating rejoin token:", error);
    return NextResponse.json(
      { error: "Er is iets misgegaan" },
      { status: 500 }
    );
  }
}
