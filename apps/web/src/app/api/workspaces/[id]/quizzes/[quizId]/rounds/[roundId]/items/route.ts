import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission, WorkspaceRole } from "@/lib/permissions";
import { z } from "zod";

const addItemSchema = z.object({
  questionId: z.string(),
});

// POST /api/workspaces/:id/quizzes/:quizId/rounds/:roundId/items - Add question to round
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; quizId: string; roundId: string}> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const quizId = (await params).quizId;
    const roundId = (await params).roundId;

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

    // Verify quiz and round belong to workspace
    const round = await prisma.quizRound.findUnique({
      where: { id: roundId },
      include: {
        quiz: true,
        items: {
          select: { order: true },
          orderBy: { order: "desc" },
          take: 1,
        },
      },
    });

    if (!round || round.quiz.workspaceId !== workspaceId || round.quizId !== quizId) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await req.json();
    const data = addItemSchema.parse(body);

    // Verify question exists and belongs to workspace
    const question = await prisma.question.findUnique({
      where: { id: data.questionId },
    });

    if (!question || question.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Determine next order number
    const nextOrder = round.items[0] ? round.items[0].order + 1 : 0;

    // Create quiz item
    const item = await prisma.quizItem.create({
      data: {
        quizRoundId: roundId,
        order: nextOrder,
        itemType: "QUESTION",
        questionId: data.questionId,
      },
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
          action: "ITEM_ADDED",
          roundId,
          itemId: item.id,
          questionId: data.questionId,
        },
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Error adding item to round:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/workspaces/:id/quizzes/:quizId/rounds/:roundId/items/:itemId - Remove item from round
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; quizId: string; roundId: string}> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const quizId = (await params).quizId;
    const roundId = (await params).roundId;

    // Get itemId from query params
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json({ error: "Item ID required" }, { status: 400 });
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

    // Verify item exists and belongs to round
    const item = await prisma.quizItem.findUnique({
      where: { id: itemId },
      include: {
        round: {
          include: {
            quiz: true,
          },
        },
      },
    });

    if (
      !item ||
      item.quizRoundId !== roundId ||
      item.round.quizId !== quizId ||
      item.round.quiz.workspaceId !== workspaceId
    ) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Delete item
    await prisma.quizItem.delete({
      where: { id: itemId },
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
          action: "ITEM_REMOVED",
          roundId,
          itemId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing item from round:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
