import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, WorkspaceRole } from "@partyquiz/shared";
import { z } from "zod";

const updateBrandingSchema = z.object({
  logo: z.string().url().nullable().optional(),
  themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format (e.g., #3B82F6)").nullable().optional(),
});

// PATCH /api/workspaces/[id]/branding - Update workspace branding
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check workspace membership and permissions
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: params.id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Only OWNER and ADMIN can update branding
    if (!hasPermission(membership.role as WorkspaceRole, "WORKSPACE_UPDATE")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validatedData = updateBrandingSchema.parse(body);

    // Update workspace branding
    const workspace = await prisma.workspace.update({
      where: { id: params.id },
      data: {
        ...(validatedData.logo !== undefined && { logo: validatedData.logo }),
        ...(validatedData.themeColor !== undefined && { themeColor: validatedData.themeColor }),
      },
    });

    return NextResponse.json({ 
      workspace: {
        id: workspace.id,
        name: workspace.name,
        logo: workspace.logo,
        themeColor: workspace.themeColor,
      }
    });
    await prisma.auditLog.create({
      data: {
        workspaceId: params.id,
        actorUserId: session.user.id,
        action: "workspace.branding.updated",
        entityType: "workspace",
        entityId: params.id,
        payloadJson: validatedData,
      },
    });

    return NextResponse.json({ workspace });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.errors },
        { status: 400 }
      );
    }
    console.error("Failed to update workspace branding:", error);
    return NextResponse.json(
      { error: "Failed to update workspace branding" },
      { status: 500 }
    );
  }
}

// GET /api/workspaces/[id]/branding - Get workspace branding
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
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
          workspaceId: params.id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        logo: true,
        themeColor: true,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error("Failed to fetch workspace branding:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace branding" },
      { status: 500 }
    );
  }
}
