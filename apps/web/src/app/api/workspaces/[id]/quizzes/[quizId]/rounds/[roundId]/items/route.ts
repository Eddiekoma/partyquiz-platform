import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission, WorkspaceRole } from "@/lib/permissions";
import { z } from "zod";

const addItemSchema = z.union([
  // Add question to round
  z.object({
    questionId: z.string(),
    itemType: z.literal("QUESTION").optional(),
    settingsJson: z.object({
      timer: z.number().min(1).max(120).optional(), // Timer in seconds (1-120s)
      points: z.number().min(1).max(100).optional(), // Base points (1-100)
    }).optional(),
  }),
  // Add scoreboard item
  z.object({
    itemType: z.literal("SCOREBOARD"),
    settingsJson: z.object({
      displayType: z.enum(["TOP_3", "TOP_5", "TOP_10", "ALL"]).optional(),
    }).optional(),
  }),
  // Add minigame item
  z.object({
    itemType: z.literal("MINIGAME"),
    minigameType: z.enum(["SWAN_RACE"]),
    settingsJson: z.object({
      duration: z.number().optional(),
    }).optional(),
  }),
  // Add break item
  z.object({
    itemType: z.literal("BREAK"),
    settingsJson: z.object({
      duration: z.number().optional(),
      message: z.string().optional(),
    }).optional(),
  }),
]);

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

    // Determine next order number
    const nextOrder = round.items[0] ? round.items[0].order + 1 : 0;

    let item;

    // Handle different item types
    if ("questionId" in data) {
      // Verify question exists and belongs to workspace
      const question = await prisma.question.findUnique({
        where: { id: data.questionId },
      });

      if (!question || question.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Question not found" }, { status: 404 });
      }

      // Create quiz item with question and optional settings
      item = await prisma.quizItem.create({
        data: {
          quizRoundId: roundId,
          order: nextOrder,
          itemType: "QUESTION",
          questionId: data.questionId,
          settingsJson: data.settingsJson || { timer: 4, points: 10 }, // Default: 4s, 10 pts
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
    } else if (data.itemType === "SCOREBOARD") {
      // Create scoreboard item
      item = await prisma.quizItem.create({
        data: {
          quizRoundId: roundId,
          order: nextOrder,
          itemType: "SCOREBOARD",
          settingsJson: data.settingsJson || { displayType: "TOP_10" },
        },
      });
    } else if (data.itemType === "MINIGAME") {
      // Create minigame item
      item = await prisma.quizItem.create({
        data: {
          quizRoundId: roundId,
          order: nextOrder,
          itemType: "MINIGAME",
          minigameType: data.minigameType,
          settingsJson: data.settingsJson || { duration: 60 },
        },
      });
    } else if (data.itemType === "BREAK") {
      // Create break item
      item = await prisma.quizItem.create({
        data: {
          quizRoundId: roundId,
          order: nextOrder,
          itemType: "BREAK",
          settingsJson: data.settingsJson || { duration: 300, message: "Break time!" },
        },
      });
    } else {
      return NextResponse.json({ error: "Invalid item type" }, { status: 400 });
    }

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
          itemType: item.itemType,
          questionId: "questionId" in data ? data.questionId : undefined,
          minigameType: "minigameType" in data ? data.minigameType : undefined,
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

    // First delete any LiveAnswers that reference this QuizItem
    await prisma.liveAnswer.deleteMany({
      where: { quizItemId: itemId },
    });

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

// PATCH schema for updating item settings
const updateItemSchema = z.object({
  itemId: z.string(),
  settingsJson: z.object({
    timer: z.number().min(1).max(120).optional(),
    points: z.number().min(1).max(100).optional(),
    displayType: z.enum(["TOP_3", "TOP_5", "TOP_10", "ALL"]).optional(),
    duration: z.number().optional(),
    message: z.string().optional(),
  }).partial(),
});

// PATCH /api/workspaces/:id/quizzes/:quizId/rounds/:roundId/items - Update item settings
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; quizId: string; roundId: string }> }
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

    // Parse request body
    const body = await req.json();
    const { itemId, settingsJson } = updateItemSchema.parse(body);

    // Verify item exists and belongs to this round/quiz/workspace
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

    // Merge new settings with existing settings
    const existingSettings = (item.settingsJson as Record<string, any>) || {};
    const updatedSettings = { ...existingSettings, ...settingsJson };

    // Update item
    const updatedItem = await prisma.quizItem.update({
      where: { id: itemId },
      data: {
        settingsJson: updatedSettings,
      },
      include: {
        question: {
          include: {
            options: { orderBy: { order: "asc" } },
            media: { orderBy: { order: "asc" } },
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
          action: "ITEM_SETTINGS_UPDATED",
          roundId,
          itemId,
          settingsJson: updatedSettings,
        },
      },
    });

    return NextResponse.json({ item: updatedItem });
  } catch (error) {
    console.error("Error updating item settings:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
