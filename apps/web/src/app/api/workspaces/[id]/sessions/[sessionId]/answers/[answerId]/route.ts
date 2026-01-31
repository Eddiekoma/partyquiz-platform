import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, WorkspaceRole } from "@partyquiz/shared";

/**
 * PATCH /api/workspaces/[id]/sessions/[sessionId]/answers/[answerId]
 * Update answer correctness and score (manual override by host)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; sessionId: string; answerId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId, sessionId, answerId } = params;
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

    if (!member || !hasPermission(member.role as WorkspaceRole, "QUIZ_UPDATE")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify session belongs to workspace
    const liveSession = await prisma.liveSession.findUnique({
      where: { id: sessionId },
    });

    if (!liveSession || liveSession.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get request body
    const body = await req.json();
    const { isCorrect, score } = body;

    // Validate input
    if (typeof isCorrect !== "boolean" && typeof score !== "number") {
      return NextResponse.json(
        { error: "Must provide isCorrect (boolean) or score (number)" },
        { status: 400 }
      );
    }

    // Update answer
    const answer = await prisma.liveAnswer.update({
      where: { id: answerId },
      data: {
        ...(typeof isCorrect === "boolean" && { isCorrect }),
        ...(typeof score === "number" && { score: Math.max(0, Math.round(score)) }),
      },
      include: {
        player: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(answer);
  } catch (error: any) {
    console.error("Error updating answer:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/workspaces/[id]/sessions/[sessionId]/answers/[answerId]
 * Delete an answer (e.g., if submitted by mistake)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; sessionId: string; answerId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId, sessionId, answerId } = params;
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

    if (!member || !hasPermission(member.role as WorkspaceRole, "QUIZ_DELETE")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify session belongs to workspace
    const liveSession = await prisma.liveSession.findUnique({
      where: { id: sessionId },
    });

    if (!liveSession || liveSession.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Delete answer
    await prisma.liveAnswer.delete({
      where: { id: answerId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting answer:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
