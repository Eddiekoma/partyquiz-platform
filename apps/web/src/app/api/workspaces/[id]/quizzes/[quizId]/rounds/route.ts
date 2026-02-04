import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission, WorkspaceRole } from "@/lib/permissions";
import { z } from "zod";

const createRoundSchema = z.object({
  title: z.string().min(1, "Title is required"),
  defaultsJson: z.object({
    timer: z.number().optional(),
    points: z.number().optional(),
    theme: z.string().optional(),
  }).optional(),
});

// POST /api/workspaces/:id/quizzes/:quizId/rounds - Create round
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; quizId: string}> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const quizId = (await params).quizId;

    // Check workspace membership and permission
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !hasPermission(membership.role as WorkspaceRole, Permission.QUIZ_UPDATE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify quiz belongs to workspace
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        rounds: {
          select: { order: true },
          orderBy: { order: "desc" },
          take: 1,
        },
      },
    });

    if (!quiz || quiz.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await req.json();
    const data = createRoundSchema.parse(body);

    // Determine next order number
    const nextOrder = quiz.rounds[0] ? quiz.rounds[0].order + 1 : 0;

    // Create round
    const round = await prisma.quizRound.create({
      data: {
        quizId,
        title: data.title,
        order: nextOrder,
        defaultsJson: data.defaultsJson || {},
      },
      include: {
        items: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: "QUIZ_UPDATED",
        entityType: "QUIZ",
        entityId: quizId,
        payloadJson: {
          action: "ROUND_CREATED",
          roundId: round.id,
          title: round.title,
        },
      },
    });

    return NextResponse.json({ round }, { status: 201 });
  } catch (error) {
    console.error("Error creating round:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/workspaces/:id/quizzes/:quizId/rounds?roundId=xxx
 * Delete a round from a quiz
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; quizId: string}> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const quizId = (await params).quizId;

    // Get roundId from query params
    const { searchParams } = new URL(req.url);
    const roundId = searchParams.get("roundId");

    if (!roundId) {
      return NextResponse.json({ error: "roundId query parameter is required" }, { status: 400 });
    }

    // Check workspace membership and permission
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !hasPermission(membership.role as WorkspaceRole, Permission.QUIZ_UPDATE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify round belongs to quiz and workspace
    const round = await prisma.quizRound.findFirst({
      where: {
        id: roundId,
        quizId,
        quiz: { workspaceId },
      },
    });

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    // Delete round (cascade deletes items)
    await prisma.quizRound.delete({
      where: { id: roundId },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: "QUIZ_UPDATED",
        entityType: "QUIZ",
        entityId: quizId,
        payloadJson: {
          action: "ROUND_DELETED",
          roundId,
          title: round.title,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting round:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
