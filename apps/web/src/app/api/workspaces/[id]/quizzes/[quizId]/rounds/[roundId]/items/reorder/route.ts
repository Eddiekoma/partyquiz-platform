import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission, WorkspaceRole } from "@/lib/permissions";
import { z } from "zod";

const reorderSchema = z.object({
  itemOrders: z.array(
    z.object({
      itemId: z.string(),
      order: z.number().int().min(0),
    })
  ),
});

/**
 * PUT /api/workspaces/:id/quizzes/:quizId/rounds/:roundId/items/reorder
 * Reorder items within a round
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; quizId: string; roundId: string}> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const quizId = (await params).quizId;
    const roundId = (await params).roundId;

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a workspace member" }, { status: 403 });
    }

    // Check permission
    if (!hasPermission(membership.role as WorkspaceRole, Permission.QUIZ_UPDATE)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
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

    // Parse and validate body
    const body = await req.json();
    const validation = reorderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { itemOrders } = validation.data;

    // Verify all items belong to this round
    const items = await prisma.quizItem.findMany({
      where: {
        id: { in: itemOrders.map((i) => i.itemId) },
        quizRoundId: roundId,
      },
    });

    if (items.length !== itemOrders.length) {
      return NextResponse.json(
        { error: "Some items not found or don't belong to this round" },
        { status: 400 }
      );
    }

    // Update orders in a transaction
    await prisma.$transaction(
      itemOrders.map((io) =>
        prisma.quizItem.update({
          where: { id: io.itemId },
          data: { order: io.order },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder items:", error);
    return NextResponse.json(
      { error: "Failed to reorder items" },
      { status: 500 }
    );
  }
}
