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

// PATCH /api/workspaces/[id]/quizzes/[quizId]/sessions - Archive ALL sessions for a quiz (unlocks editing)
export async function PATCH(
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

    // Check membership - require SESSION_DELETE permission (OWNER or ADMIN)
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, Permission.SESSION_DELETE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify quiz belongs to workspace
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { workspaceId: true, title: true },
    });

    if (!quiz || quiz.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Archive all non-archived sessions for this quiz
    const archiveResult = await prisma.liveSession.updateMany({
      where: { 
        quizId,
        status: { not: "ARCHIVED" },
      },
      data: {
        status: "ARCHIVED",
        endedAt: new Date(),
      },
    });

    if (archiveResult.count === 0) {
      return NextResponse.json({ message: "No sessions to archive", archivedCount: 0 });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: "SESSION_ARCHIVED",
        entityType: "QUIZ",
        entityId: quizId,
        payloadJson: {
          action: "ALL_SESSIONS_ARCHIVED",
          quizTitle: quiz.title,
          archivedCount: archiveResult.count,
        },
      },
    });

    return NextResponse.json({ 
      message: `Archived ${archiveResult.count} session(s). Quiz is now editable.`,
      archivedCount: archiveResult.count,
    });
  } catch (error) {
    console.error("Error archiving sessions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id]/quizzes/[quizId]/sessions - Delete ALL sessions for a quiz (permanent)
export async function DELETE(
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

    // Check membership - require SESSION_DELETE permission (OWNER or ADMIN)
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, Permission.SESSION_DELETE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify quiz belongs to workspace
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { workspaceId: true, title: true },
    });

    if (!quiz || quiz.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Get all session IDs for this quiz
    const sessionIds = await prisma.liveSession.findMany({
      where: { quizId },
      select: { id: true },
    });

    const sessionIdList = sessionIds.map(s => s.id);

    if (sessionIdList.length === 0) {
      return NextResponse.json({ message: "No sessions to delete", deletedCount: 0 });
    }

    // Delete in order to respect foreign key constraints:
    // 1. Delete LiveAnswers (references LiveSession and QuizItem)
    await prisma.liveAnswer.deleteMany({
      where: { sessionId: { in: sessionIdList } },
    });

    // 2. Delete LivePlayers (references LiveSession)
    await prisma.livePlayer.deleteMany({
      where: { sessionId: { in: sessionIdList } },
    });

    // 3. Delete LiveSessions
    const deleteResult = await prisma.liveSession.deleteMany({
      where: { quizId },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: "SESSION_DELETED",
        entityType: "QUIZ",
        entityId: quizId,
        payloadJson: {
          action: "ALL_SESSIONS_DELETED",
          quizTitle: quiz.title,
          deletedCount: deleteResult.count,
        },
      },
    });

    return NextResponse.json({ 
      message: `Deleted ${deleteResult.count} session(s)`,
      deletedCount: deleteResult.count,
    });
  } catch (error) {
    console.error("Error deleting sessions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}