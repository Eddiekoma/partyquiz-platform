import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/sessions/code/[code] - Get session by join code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const code = (await params).code.toUpperCase();

    const session = await prisma.liveSession.findUnique({
      where: { code },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            logo: true,
            themeColor: true,
          },
        },
        quiz: {
          include: {
            rounds: {
              orderBy: { order: "asc" },
              include: {
                items: {
                  orderBy: { order: "asc" },
                  include: {
                    question: {
                      include: {
                        options: {
                          orderBy: { order: "asc" },
                        },
                        media: {
                          orderBy: { order: "asc" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        host: {
          select: {
            id: true,
            name: true,
          },
        },
        players: {
          where: {
            leftAt: null, // Only active players
          },
          orderBy: {
            joinedAt: "asc",
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Transform players to include score (from answers)
    const playersWithScores = await Promise.all(
      session.players.map(async (player) => {
        const answers = await prisma.liveAnswer.findMany({
          where: {
            sessionId: session.id,
            playerId: player.id,
          },
        });
        
        const score = answers.reduce((sum, answer) => sum + answer.score, 0);
        
        return {
          id: player.id,
          name: player.name,
          avatar: player.avatar,
          score,
          isOnline: true, // Would need real-time tracking
          joinedAt: player.joinedAt,
        };
      })
    );

    return NextResponse.json({
      session: {
        id: session.id,
        code: session.code,
        status: session.status,
        workspaceId: session.workspaceId,
        workspace: session.workspace,
        quiz: session.quiz,
        host: session.host,
        players: playersWithScores,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      },
    });
  } catch (error) {
    console.error("Failed to get session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
