import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, WorkspaceRole, Permission } from "@/lib/permissions";

// GET /api/workspaces/[id]/question-sets/[setId]/questions - Get questions in a set
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
    const { searchParams } = new URL(request.url);

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

    // Verify the set belongs to the workspace
    const questionSet = await prisma.questionSet.findFirst({
      where: {
        id: setId,
        workspaceId,
      },
    });

    if (!questionSet) {
      return NextResponse.json({ error: "Question set not found" }, { status: 404 });
    }

    // Parse filters
    const type = searchParams.get("type");
    const difficulty = searchParams.get("difficulty");
    const status = searchParams.get("status");
    const tag = searchParams.get("tag");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // Build where clause
    const where: Record<string, unknown> = {
      workspaceId,
      questionSetId: setId,
    };

    if (type) where.type = type;
    if (difficulty) where.difficulty = parseInt(difficulty);
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { prompt: { contains: search, mode: "insensitive" } },
      ];
    }

    // Count total for pagination
    const total = await prisma.question.count({ where });
    const totalPages = Math.ceil(total / limit);

    // Fetch questions
    const questions = await prisma.question.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        options: {
          orderBy: { order: "asc" },
        },
        media: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get available tags for filters
    const allQuestions = await prisma.question.findMany({
      where: { workspaceId, questionSetId: setId },
      select: { tagsJson: true },
    });

    const allTags = new Set<string>();
    allQuestions.forEach((q) => {
      if (Array.isArray(q.tagsJson)) {
        (q.tagsJson as string[]).forEach((t) => allTags.add(t));
      }
    });

    return NextResponse.json({
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        title: q.title,
        prompt: q.prompt,
        explanation: q.explanation,
        difficulty: q.difficulty,
        status: q.status,
        tagsJson: q.tagsJson,
        createdAt: q.createdAt.toISOString(),
        creator: q.creator,
        options: q.options,
        media: q.media,
      })),
      questionSet: {
        id: questionSet.id,
        name: questionSet.name,
        description: questionSet.description,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filters: {
        availableTags: Array.from(allTags).sort(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch questions:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 }
    );
  }
}
