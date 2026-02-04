import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission, WorkspaceRole } from "@/lib/permissions";
import { z } from "zod";

const updateSessionSchema = z.object({
  status: z.enum(["LOBBY", "ACTIVE", "PAUSED", "ENDED"]).optional(),
});

/**
 * GET /api/workspaces/:id/sessions/:sessionId
 * Get session details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; sessionId: string}> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const sessionId = (await params).sessionId;

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

    // Fetch session
    const liveSession = await prisma.liveSession.findFirst({
      where: {
        id: sessionId,
        workspaceId,
      },
      include: {
        quiz: {
          include: {
            rounds: {
              include: {
                items: {
                  include: {
                    question: {
                      include: {
                        options: true,
                        media: true,
                      },
                    },
                  },
                  orderBy: { order: "asc" },
                },
              },
              orderBy: { order: "asc" },
            },
          },
        },
        host: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        players: {
          where: {
            leftAt: null, // Only active players
          },
          orderBy: { joinedAt: "asc" },
        },
        _count: {
          select: {
            answers: true,
          },
        },
      },
    });

    if (!liveSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ session: liveSession });
  } catch (error) {
    console.error("Failed to fetch session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workspaces/:id/sessions/:sessionId
 * Update session (e.g., change status)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; sessionId: string}> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const sessionId = (await params).sessionId;

    // Check workspace membership and permission
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !hasPermission(membership.role as WorkspaceRole, Permission.SESSION_UPDATE)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Verify session belongs to workspace
    const existingSession = await prisma.liveSession.findFirst({
      where: {
        id: sessionId,
        workspaceId,
      },
    });

    if (!existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Only host can update session
    if (existingSession.hostUserId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the host can update this session" },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await req.json();
    const validation = updateSessionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const updateData: any = {};
    
    if (validation.data.status) {
      updateData.status = validation.data.status;
      
      // Set endedAt when ending session
      if (validation.data.status === "ENDED" && !existingSession.endedAt) {
        updateData.endedAt = new Date();
      }
    }

    // Update session
    const updatedSession = await prisma.liveSession.update({
      where: { id: sessionId },
      data: updateData,
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
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: "SESSION_UPDATED",
        entityType: "SESSION",
        entityId: sessionId,
        payloadJson: {
          changes: validation.data,
        },
      },
    });

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    console.error("Failed to update session:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/:id/sessions/:sessionId
 * Delete a session
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; sessionId: string}> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const sessionId = (await params).sessionId;

    // Check workspace membership and permission
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !hasPermission(membership.role as WorkspaceRole, Permission.SESSION_DELETE)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Verify session belongs to workspace
    const existingSession = await prisma.liveSession.findFirst({
      where: {
        id: sessionId,
        workspaceId,
      },
    });

    if (!existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Only host can delete session
    if (existingSession.hostUserId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the host can delete this session" },
        { status: 403 }
      );
    }

    // Delete session (cascade deletes players and answers)
    await prisma.liveSession.delete({
      where: { id: sessionId },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: "SESSION_DELETED",
        entityType: "SESSION",
        entityId: sessionId,
        payloadJson: {
          code: existingSession.code,
          quizId: existingSession.quizId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
