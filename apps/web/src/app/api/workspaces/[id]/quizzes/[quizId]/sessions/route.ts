import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasPermission, WorkspaceRole, Permission } from "@/lib/permissions";

// Generate a unique 6-character session code
function generateSessionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude similar looking chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /api/workspaces/[id]/quizzes/[quizId]/sessions - Create a new live session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; quizId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const quizId = (await params).quizId;

    // Check membership and permissions
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, Permission.SESSION_CREATE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if quiz exists and has questions
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        rounds: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!quiz || quiz.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const totalQuestions = quiz.rounds.reduce((sum, round) => sum + round.items.length, 0);
    if (totalQuestions === 0) {
      return NextResponse.json({ error: "Quiz has no questions" }, { status: 400 });
    }

    // Generate unique session code
    let code = generateSessionCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.liveSession.findUnique({
        where: { code },
      });
      if (!existing) break;
      code = generateSessionCode();
      attempts++;
    }

    // Create the live session
    const liveSession = await prisma.liveSession.create({
      data: {
        code,
        quizId,
        workspaceId,
        hostUserId: session.user.id,
        status: "LOBBY",
      },
    });

    return NextResponse.json({
      session: liveSession,
      hostUrl: `/host/${liveSession.code}`,
      displayUrl: `/display/${liveSession.code}`,
      joinUrl: `/play/${liveSession.code}`,
    });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/workspaces/[id]/quizzes/[quizId]/sessions - List sessions for this quiz
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; quizId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const quizId = (await params).quizId;

    // Check membership
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sessions = await prisma.liveSession.findMany({
      where: { quizId },
      orderBy: { startedAt: "desc" },
      include: {
        host: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            players: true,
          },
        },
      },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Failed to list sessions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
