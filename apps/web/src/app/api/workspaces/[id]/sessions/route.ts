import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission, WorkspaceRole } from "@/lib/permissions";
import { z } from "zod";

const createSessionSchema = z.object({
  quizId: z.string().min(1, "Quiz ID is required"),
});

/**
 * Generate a unique 6-character session code
 */
async function generateSessionCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude ambiguous chars
  let code: string;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const existing = await prisma.liveSession.findUnique({
      where: { code },
    });
    
    if (!existing) break;
    
    attempts++;
    if (attempts >= maxAttempts) {
      throw new Error("Failed to generate unique session code");
    }
  } while (true);

  return code;
}

/**
 * GET /api/workspaces/:id/sessions
 * List sessions for a workspace
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{  id: string}> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;

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

    // Parse query params
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // LOBBY, ACTIVE, ENDED
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // Build where clause
    const where: any = { workspaceId };
    if (status) {
      where.status = status;
    }

    // Fetch sessions
    const [sessions, total] = await Promise.all([
      prisma.liveSession.findMany({
        where,
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
            },
          },
          host: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              players: true,
              answers: true,
            },
          },
        },
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.liveSession.count({ where }),
    ]);

    return NextResponse.json({
      sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:id/sessions
 * Create a new session
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{  id: string}> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;

    // Check workspace membership and permission
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !hasPermission(membership.role as WorkspaceRole, Permission.SESSION_CREATE)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Parse and validate body
    const body = await req.json();
    const validation = createSessionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { quizId } = validation.data;

    // Verify quiz belongs to workspace
    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, workspaceId },
      include: {
        rounds: {
          include: {
            items: {
              include: {
                question: true,
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Verify quiz has questions
    const hasQuestions = quiz.rounds.some((round: any) => round.items.length > 0);
    if (!hasQuestions) {
      return NextResponse.json(
        { error: "Quiz must have at least one question" },
        { status: 400 }
      );
    }

    // Generate unique session code
    const code = await generateSessionCode();

    // Create session
    const liveSession = await prisma.liveSession.create({
      data: {
        workspaceId,
        quizId,
        code,
        status: "LOBBY",
        hostUserId: session.user.id,
      },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
        host: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: "SESSION_CREATED",
        entityType: "SESSION",
        entityId: liveSession.id,
        payloadJson: {
          code: liveSession.code,
          quizId: quiz.id,
          quizTitle: quiz.title,
        },
      },
    });

    return NextResponse.json({ session: liveSession }, { status: 201 });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
