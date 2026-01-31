import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission, WorkspaceRole } from "@/lib/permissions";
import { z } from "zod";

const updateQuizSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

// GET /api/workspaces/:id/quizzes/:quizId - Get quiz details
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; quizId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = params.id;
    const quizId = params.quizId;

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

    return NextResponse.json({ quiz });
  } catch (error) {
    console.error("Error fetching quiz:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/workspaces/:id/quizzes/:quizId - Update quiz
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; quizId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = params.id;
    const quizId = params.quizId;

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
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/workspaces/:id/quizzes/:quizId - Delete quiz
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; quizId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = params.id;
    const quizId = params.quizId;

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

    // Prevent deletion if quiz has sessions
    if (existingQuiz._count.sessions > 0) {
      return NextResponse.json(
        { error: "Cannot delete quiz with existing sessions" },
        { status: 400 }
      );
    }

    // Delete quiz (cascades to rounds and items)
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
