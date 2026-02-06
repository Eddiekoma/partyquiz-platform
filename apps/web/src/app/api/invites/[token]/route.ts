import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/invites/[token] - Get invite details (for preview before accepting)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const invite = await prisma.workspaceInvite.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        invitedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    // Check if expired
    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invite has expired" },
        { status: 410 }
      );
    }

    // Check if already accepted
    if (invite.acceptedAt) {
      return NextResponse.json(
        { error: "Invite has already been accepted" },
        { status: 410 }
      );
    }

    // Return invite details (without sensitive data like the full token)
    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      workspace: invite.workspace,
      invitedBy: invite.invitedBy,
    });
  } catch (error) {
    console.error("Failed to fetch invite:", error);
    return NextResponse.json(
      { error: "Failed to fetch invite" },
      { status: 500 }
    );
  }
}

// POST /api/invites/[token] - Accept invite
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await params;

  try {
    const invite = await prisma.workspaceInvite.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    // Check if expired
    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invite has expired" },
        { status: 410 }
      );
    }

    // Check if already accepted
    if (invite.acceptedAt) {
      return NextResponse.json(
        { error: "Invite has already been accepted" },
        { status: 410 }
      );
    }

    // Check if this invite was for the current user's email
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    if (user?.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        { error: "This invite was sent to a different email address" },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (existingMember) {
      // Mark invite as accepted anyway
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return NextResponse.json({
        message: "You are already a member of this workspace",
        workspaceId: invite.workspaceId,
      });
    }

    // Accept invite: create member and mark invite as accepted
    const [member] = await prisma.$transaction([
      prisma.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: session.user.id,
          role: invite.role,
        },
      }),
      prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          workspaceId: invite.workspaceId,
          actorUserId: session.user.id,
          action: "MEMBER_JOINED",
          entityType: "WORKSPACE_MEMBER",
          entityId: session.user.id,
          payloadJson: {
            role: invite.role,
            inviteId: invite.id,
          },
        },
      }),
    ]);

    return NextResponse.json({
      message: "Successfully joined workspace",
      workspaceId: invite.workspaceId,
      workspaceName: invite.workspace.name,
      role: member.role,
    });
  } catch (error) {
    console.error("Failed to accept invite:", error);
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 }
    );
  }
}
