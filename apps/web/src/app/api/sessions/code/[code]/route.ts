import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePresignedDownloadUrl, getPublicUrl } from "@/lib/storage";

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

    // Check if session is archived
    if (session.status === "ARCHIVED") {
      return NextResponse.json(
        { 
          error: "Session is archived",
          message: "This session has been archived and can no longer be played. The quiz was updated after this session was created.",
          archived: true
        },
        { status: 410 } // 410 Gone
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

    // Resolve media URLs for all questions
    const quizWithResolvedMedia = {
      ...session.quiz,
      rounds: await Promise.all(session.quiz.rounds.map(async (round) => ({
        ...round,
        items: await Promise.all(round.items.map(async (item) => ({
          ...item,
          question: item.question
            ? {
                ...item.question,
                media: await Promise.all(item.question.media.map(async (m) => {
                  const ref = m.reference as any;
                  let resolvedUrl: string | null = null;
                  if (m.provider === "UPLOAD" && ref?.storageKey) {
                    try {
                      resolvedUrl = await generatePresignedDownloadUrl(ref.storageKey, 7200);
                    } catch {
                      try {
                        resolvedUrl = getPublicUrl(ref.storageKey);
                      } catch {
                        resolvedUrl = null;
                      }
                    }
                  } else if (m.provider === "YOUTUBE" && ref?.videoId) {
                    resolvedUrl = `https://www.youtube.com/watch?v=${ref.videoId}`;
                  } else if (m.provider === "SPOTIFY" && ref?.trackId) {
                    // Spotify uses Web Playback SDK, no URL needed — trackId is sufficient
                    resolvedUrl = null;
                  }
                  return {
                    ...m,
                    reference: {
                      ...ref,
                      url: ref?.url || resolvedUrl,
                    },
                  };
                })),
              }
            : null,
        }))),
      }))),
    };

    return NextResponse.json({
      session: {
        id: session.id,
        code: session.code,
        status: session.status,
        workspaceId: session.workspaceId,
        workspace: session.workspace,
        quiz: quizWithResolvedMedia,
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
