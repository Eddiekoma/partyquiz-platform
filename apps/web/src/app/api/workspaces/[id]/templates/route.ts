import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/workspaces/[id]/templates - Get quiz templates
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{  id: string}> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: (await params).id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Get templates from this workspace or global templates
    const templates = await prisma.quiz.findMany({
      where: {
        isTemplate: true,
        workspaceId: (await params).id,
      },
      include: {
        rounds: {
          orderBy: { order: "asc" },
          include: {
            items: {
              orderBy: { order: "asc" },
              include: {
                question: {
                  select: {
                    id: true,
                    type: true,
                    title: true,
                    difficulty: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            rounds: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Count total questions per template
    const templatesWithCounts = templates.map((template) => {
      const totalQuestions = template.rounds.reduce(
        (sum, round) => sum + round.items.length,
        0
      );
      return {
        ...template,
        totalQuestions,
      };
    });

    return NextResponse.json({ templates: templatesWithCounts });
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST /api/workspaces/[id]/templates - Create quiz from template
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{  id: string}> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: (await params).id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const body = await req.json();
    const { templateId, title } = body;

    if (!templateId) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 });
    }

    // Fetch template with all relations
    const template = await prisma.quiz.findUnique({
      where: { id: templateId },
      include: {
        rounds: {
          orderBy: { order: "asc" },
          include: {
            items: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (!template.isTemplate) {
      return NextResponse.json({ error: "Not a template" }, { status: 400 });
    }

    // Create new quiz from template
    const newQuiz = await prisma.quiz.create({
      data: {
        workspaceId: (await params).id,
        title: title || `${template.title} (Copy)`,
        description: template.description,
        createdBy: session.user.id,
        isTemplate: false,
        rounds: {
          create: template.rounds.map((round) => ({
            title: round.title,
            order: round.order,
            items: {
              create: round.items.map((item) => ({
                itemType: item.itemType,
                questionId: item.questionId,
                minigameType: (item as any).minigameType || null,
                order: item.order,
                settingsJson: item.settingsJson || {},
              })),
            },
          })),
        },
      } as any,
      include: {
        rounds: {
          include: {
            items: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        workspaceId: (await params).id,
        actorUserId: session.user.id,
        action: "quiz.created_from_template",
        entityType: "quiz",
        entityId: newQuiz.id,
        payloadJson: {
          templateId,
          templateTitle: template.title,
        },
      },
    });

    return NextResponse.json({ quiz: newQuiz }, { status: 201 });
  } catch (error) {
    console.error("Failed to create quiz from template:", error);
    return NextResponse.json(
      { error: "Failed to create quiz from template" },
      { status: 500 }
    );
  }
}
