import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission, WorkspaceRole } from "@/lib/permissions";
import { z } from "zod";

const scoringSettingsSchema = z.object({
  basePoints: z.number().min(1).max(1000).optional(),
  timeBonusEnabled: z.boolean().optional(),
  timeBonusPercentage: z.number().min(0).max(100).optional(),
  streakBonusEnabled: z.boolean().optional(),
  streakBonusPoints: z.number().min(1).max(10).optional(),
}).optional();

const updateQuizSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  scoringSettingsJson: scoringSettingsSchema,
});

// GET /api/workspaces/:id/quizzes/:quizId - Get quiz details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; quizId: string}> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const quizId = (await params).quizId;

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !hasPermission(membership.role as WorkspaceRole, Permission.QUIZ_VIEW)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get quiz with rounds and items
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        rounds: {
          include: {
            items: {
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
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
        _count: {
          select: { sessions: true },
        },
      },
    });

    if (!quiz || quiz.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Count active (non-archived) sessions separately
    const activeSessionCount = await prisma.liveSession.count({
      where: {
        quizId,
        status: { not: "ARCHIVED" },
      },
    });

    // Quiz is locked if it has any ACTIVE (non-archived) sessions
    const isLocked = activeSessionCount > 0;

    return NextResponse.json({ 
      quiz,
      isLocked,
      sessionCount: activeSessionCount,
      totalSessionCount: quiz._count.sessions,
    });
  } catch (error) {
    console.error("Error fetching quiz:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/workspaces/:id/quizzes/:quizId - Update quiz
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; quizId: string}> }
) {
  try {
    const session = await auth();
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
    const existingQuiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!existingQuiz || existingQuiz.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await req.json();
    const data = updateQuizSchema.parse(body);

    // Update quiz
    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        title: data.title,
        description: data.description,
        scoringSettingsJson: data.scoringSettingsJson,
      },
      include: {
        rounds: {
          include: {
            items: true,
          },
          orderBy: { order: "asc" },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: "QUIZ_UPDATED",
        entityType: "QUIZ",
        entityId: quiz.id,
        payloadJson: {
          changes: data,
        },
      },
    });

    return NextResponse.json({ quiz });
  } catch (error) {
    console.error("Error updating quiz:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/workspaces/:id/quizzes/:quizId - Delete quiz
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; quizId: string}> }
) {
  try {
    const session = await auth();
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

    if (!membership || !hasPermission(membership.role as WorkspaceRole, Permission.QUIZ_DELETE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify quiz belongs to workspace
    const existingQuiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        _count: {
          select: { sessions: true },
        },
      },
    });

    if (!existingQuiz || existingQuiz.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Delete all related data in the correct order to avoid FK constraint violations
    // 1. Get all QuizItem IDs for this quiz
    const quizItems = await prisma.quizItem.findMany({
      where: {
        round: { quizId },
      },
      select: { id: true },
    });
    const quizItemIds = quizItems.map(item => item.id);

    // 2. Delete LiveAnswers (references QuizItems)
    if (quizItemIds.length > 0) {
      await prisma.liveAnswer.deleteMany({
        where: { quizItemId: { in: quizItemIds } },
      });
    }

    // 3. Get all session IDs for this quiz
    const sessions = await prisma.liveSession.findMany({
      where: { quizId },
      select: { id: true },
    });
    const sessionIds = sessions.map(s => s.id);

    // 4. Delete LivePlayers (references LiveSessions)
    if (sessionIds.length > 0) {
      await prisma.livePlayer.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });
    }

    // 5. Delete LiveSessions
    await prisma.liveSession.deleteMany({
      where: { quizId },
    });

    // 6. Delete quiz (cascades to rounds and items)
    await prisma.quiz.delete({
      where: { id: quizId },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: "QUIZ_DELETED",
        entityType: "QUIZ",
        entityId: quizId,
        payloadJson: {
          title: existingQuiz.title,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quiz:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
