import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, WorkspaceRole } from "@partyquiz/shared";
import { z } from "zod";

const updateMemberSchema = z.object({
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
});

// PATCH /api/workspaces/[id]/members/[userId] - Update member role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; userId: string}> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check permissions
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: (await params).id,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, "MEMBER_UPDATE_ROLE")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const data = updateMemberSchema.parse(body);

    // Can't change owner role
    const targetMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: (await params).id,
          userId: (await params).userId,
        },
      },
    });

    if (targetMember?.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot change owner role" },
        { status: 400 }
      );
    }

    const updatedMember = await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId: (await params).id,
          userId: (await params).userId,
        },
      },
      data: {
        role: data.role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Log the update
    await prisma.auditLog.create({
      data: {
        workspaceId: (await params).id,
        actorUserId: session.user.id,
        action: "MEMBER_ROLE_UPDATED",
        entityType: "WORKSPACE_MEMBER",
        entityId: updatedMember.id,
        payloadJson: {
          targetUserId: (await params).userId,
          newRole: data.role,
        },
      },
    });

    return NextResponse.json(updatedMember);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    console.error("Failed to update member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/[id]/members/[userId] - Remove member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; userId: string}> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check permissions
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: (await params).id,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, "MEMBER_REMOVE")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Can't remove owner
    const targetMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: (await params).id,
          userId: (await params).userId,
        },
      },
    });

    if (targetMember?.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot remove workspace owner" },
        { status: 400 }
      );
    }

    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId: (await params).id,
          userId: (await params).userId,
        },
      },
    });

    // Log the removal
    await prisma.auditLog.create({
      data: {
        workspaceId: (await params).id,
        actorUserId: session.user.id,
        action: "MEMBER_REMOVED",
        entityType: "WORKSPACE_MEMBER",
        payloadJson: {
          targetUserId: (await params).userId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
