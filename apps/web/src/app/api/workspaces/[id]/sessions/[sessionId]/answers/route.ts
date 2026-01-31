import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, WorkspaceRole } from "@partyquiz/shared";

/**
 * GET /api/workspaces/[id]/sessions/[sessionId]/answers
 * Get all answers for a session (for review/analysis)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId, sessionId } = params;
    const userId = session.user.id;

    // Check workspace permission
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, "SESSION_VIEW")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify session belongs to workspace
    const liveSession = await prisma.liveSession.findUnique({
      where: { id: sessionId },
    });

    if (!liveSession || liveSession.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    const playerId = searchParams.get("playerId");

    // Build where clause
    const where: any = {
      sessionId,
    };

    if (itemId) where.quizItemId = itemId;
    if (playerId) where.playerId = playerId;

    // Get answers
    const answers = await prisma.liveAnswer.findMany({
      where,
      include: {
        player: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        quizItem: {
          select: {
            id: true,
            order: true,
            question: {
              select: {
                id: true,
                type: true,
                title: true,
                prompt: true,
              },
            },
          },
        },
      },
      orderBy: {
        answeredAt: "asc",
      },
    });

    return NextResponse.json(answers);
  } catch (error: any) {
    console.error("Error fetching answers:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
