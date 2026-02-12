import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, WorkspaceRole, Permission } from "@/lib/permissions";
import { z } from "zod";

const updateQuestionSetSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long").optional(),
  description: z.string().max(500, "Description is too long").nullable().optional(),
});

// GET /api/workspaces/[id]/question-sets/[setId] - Get a single question set with questions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; setId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId, setId } = await params;

    // Check membership and permissions
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, Permission.QUESTION_VIEW)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const questionSet = await prisma.questionSet.findFirst({
      where: {
        id: setId,
        workspaceId,
      },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });

    if (!questionSet) {
      return NextResponse.json({ error: "Question set not found" }, { status: 404 });
    }

    return NextResponse.json({
      questionSet: {
        id: questionSet.id,
        name: questionSet.name,
        description: questionSet.description,
        questionCount: questionSet._count.questions,
        createdAt: questionSet.createdAt.toISOString(),
        updatedAt: questionSet.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch question set:", error);
    return NextResponse.json(
      { error: "Failed to fetch question set" },
      { status: 500 }
    );
  }
}

// PATCH /api/workspaces/[id]/question-sets/[setId] - Update a question set
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; setId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId, setId } = await params;

    // Check membership and permissions
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, Permission.QUESTION_UPDATE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingSet = await prisma.questionSet.findFirst({
      where: {
        id: setId,
        workspaceId,
      },
    });

    if (!existingSet) {
      return NextResponse.json({ error: "Question set not found" }, { status: 404 });
    }

    // Prevent renaming the Uncategorized set
    const body = await request.json();
    if (existingSet.name === "Uncategorized" && body.name && body.name !== "Uncategorized") {
      return NextResponse.json(
        { error: "Cannot rename the Uncategorized set" },
        { status: 400 }
      );
    }

    const validation = updateQuestionSetSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description } = validation.data;

    // Check for duplicate name if renaming
    if (name && name !== existingSet.name) {
      const duplicate = await prisma.questionSet.findFirst({
        where: {
          workspaceId,
          name: { equals: name, mode: "insensitive" },
          id: { not: setId },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "A question set with this name already exists" },
          { status: 400 }
        );
      }
    }

    const questionSet = await prisma.questionSet.update({
      where: { id: setId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });

    return NextResponse.json({
      questionSet: {
        id: questionSet.id,
        name: questionSet.name,
        description: questionSet.description,
        questionCount: questionSet._count.questions,
        createdAt: questionSet.createdAt.toISOString(),
        updatedAt: questionSet.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to update question set:", error);
    return NextResponse.json(
      { error: "Failed to update question set" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/[id]/question-sets/[setId] - Delete a question set
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; setId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId, setId } = await params;

    // Check membership and permissions
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, Permission.QUESTION_DELETE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingSet = await prisma.questionSet.findFirst({
      where: {
        id: setId,
        workspaceId,
      },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });

    if (!existingSet) {
      return NextResponse.json({ error: "Question set not found" }, { status: 404 });
    }

    // Prevent deleting the Uncategorized set
    if (existingSet.name === "Uncategorized") {
      return NextResponse.json(
        { error: "Cannot delete the Uncategorized set" },
        { status: 400 }
      );
    }

    // Get or create Uncategorized set for this workspace
    let uncategorizedSet = await prisma.questionSet.findFirst({
      where: {
        workspaceId,
        name: "Uncategorized",
      },
    });

    if (!uncategorizedSet) {
      uncategorizedSet = await prisma.questionSet.create({
        data: {
          workspaceId,
          name: "Uncategorized",
          description: "Default set for questions without a specific category",
        },
      });
    }

    // Move all questions to Uncategorized before deleting the set
    await prisma.question.updateMany({
      where: { questionSetId: setId },
      data: { questionSetId: uncategorizedSet.id },
    });

    await prisma.questionSet.delete({
      where: { id: setId },
    });

    return NextResponse.json({
      message: "Question set deleted",
      questionsMovedTo: "Uncategorized",
      questionCount: existingSet._count.questions,
    });
  } catch (error) {
    console.error("Failed to delete question set:", error);
    return NextResponse.json(
      { error: "Failed to delete question set" },
      { status: 500 }
    );
  }
}
