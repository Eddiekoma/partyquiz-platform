import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, WorkspaceRole, Permission } from "@/lib/permissions";
import { z } from "zod";

const createQuestionSetSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().max(500, "Description is too long").optional(),
});

// GET /api/workspaces/[id]/question-sets - List all question sets
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId } = await params;

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

    const questionSets = await prisma.questionSet.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { questions: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // Move Uncategorized to top if it exists
    const sorted = [...questionSets].sort((a, b) => {
      if (a.name === "Uncategorized") return -1;
      if (b.name === "Uncategorized") return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      questionSets: sorted.map((set) => ({
        id: set.id,
        name: set.name,
        description: set.description,
        questionCount: set._count.questions,
        createdAt: set.createdAt.toISOString(),
        updatedAt: set.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch question sets:", error);
    return NextResponse.json(
      { error: "Failed to fetch question sets" },
      { status: 500 }
    );
  }
}

// POST /api/workspaces/[id]/question-sets - Create a new question set
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId } = await params;

    // Check membership and permissions
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, Permission.QUESTION_CREATE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = createQuestionSetSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description } = validation.data;

    // Check for duplicate name
    const existing = await prisma.questionSet.findFirst({
      where: {
        workspaceId,
        name: { equals: name, mode: "insensitive" },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A question set with this name already exists" },
        { status: 400 }
      );
    }

    const questionSet = await prisma.questionSet.create({
      data: {
        workspaceId,
        name,
        description,
      },
    });

    return NextResponse.json({
      questionSet: {
        id: questionSet.id,
        name: questionSet.name,
        description: questionSet.description,
        questionCount: 0,
        createdAt: questionSet.createdAt.toISOString(),
        updatedAt: questionSet.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to create question set:", error);
    return NextResponse.json(
      { error: "Failed to create question set" },
      { status: 500 }
    );
  }
}
