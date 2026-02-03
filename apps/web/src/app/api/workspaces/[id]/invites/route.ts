import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, WorkspaceRole } from "@partyquiz/shared";
import { z } from "zod";
import { randomBytes } from "crypto";

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
});

// POST /api/workspaces/[id]/invites - Invite member to workspace
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{  id: string}> }
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

    if (!member || !hasPermission(member.role as WorkspaceRole, "MEMBER_INVITE")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const data = inviteMemberSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    // Check if already a member
    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: (await params).id,
            userId: existingUser.id,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: "User is already a member" },
          { status: 400 }
        );
      }
    }

    // Generate invite token
    const token = randomBytes(32).toString("hex");
    
    // Invite expires in 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId: (await params).id,
        email: data.email,
        role: data.role,
        token,
        invitedById: session.user.id,
        expiresAt,
      },
      include: {
        workspace: {
          select: {
            name: true,
          },
        },
      },
    });

    // TODO: Send email with invite link
    // For now, just return the invite
    console.log(`Invite link: ${process.env.NEXTAUTH_URL}/invites/${token}`);

    // Log the invite
    await prisma.auditLog.create({
      data: {
        workspaceId: (await params).id,
        actorUserId: session.user.id,
        action: "MEMBER_INVITED",
        entityType: "WORKSPACE_INVITE",
        entityId: invite.id,
        payloadJson: {
          email: data.email,
          role: data.role,
        },
      },
    });

    return NextResponse.json(invite);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    console.error("Failed to invite member:", error);
    return NextResponse.json(
      { error: "Failed to invite member" },
      { status: 500 }
    );
  }
}
