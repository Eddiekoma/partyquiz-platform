import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission, WorkspaceRole } from "@/lib/permissions";
import { z } from "zod";

const reorderSchema = z.object({
  roundOrders: z.array(
    z.object({
      roundId: z.string(),
      order: z.number().int().min(0),
    })
  ),
});

/**
 * PUT /api/workspaces/:id/quizzes/:quizId/rounds/reorder
 * Reorder rounds within a quiz
 */
export async function PUT(
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

    // Verify quiz belongs to workspace
    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, workspaceId },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
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

    const { roundOrders } = validation.data;

    // Verify all rounds belong to this quiz
    const rounds = await prisma.quizRound.findMany({
      where: {
        id: { in: roundOrders.map((r) => r.roundId) },
        quizId,
      },
    });

    if (rounds.length !== roundOrders.length) {
      return NextResponse.json(
        { error: "Some rounds not found or don't belong to this quiz" },
        { status: 400 }
      );
    }

    // Update orders in a transaction
    await prisma.$transaction(
      roundOrders.map((ro) =>
        prisma.quizRound.update({
          where: { id: ro.roundId },
          data: { order: ro.order },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder rounds:", error);
    return NextResponse.json(
      { error: "Failed to reorder rounds" },
      { status: 500 }
    );
  }
}
