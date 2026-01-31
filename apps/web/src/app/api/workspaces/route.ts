import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WorkspaceRole } from "@partyquiz/shared";
import { z } from "zod";

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

// Helper function to generate URL-safe slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50) + "-" + Math.random().toString(36).substring(2, 8);
}

// GET /api/workspaces - List all workspaces for current user
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: session.user.id,
          },
        },
      },
      include: {
        _count: {
          select: {
            members: true,
            questions: true,
            quizzes: true,
          },
        },
        members: {
          where: {
            userId: session.user.id,
          },
          select: {
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const workspacesWithRole = workspaces.map((workspace: any) => ({
      ...workspace,
      role: workspace.members[0]?.role,
      members: undefined, // Remove the nested members array
    }));

    return NextResponse.json(workspacesWithRole);
  } catch (error) {
    console.error("Failed to fetch workspaces:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}

// POST /api/workspaces - Create new workspace
export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createWorkspaceSchema.parse(body);

    const slug = generateSlug(data.name);

    const workspace = await prisma.workspace.create({
      data: {
        name: data.name,
        description: data.description,
        slug,
        ownerId: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            role: WorkspaceRole.OWNER,
          },
        },
      },
      include: {
        _count: {
          select: {
            members: true,
            questions: true,
            quizzes: true,
          },
        },
      },
    });

    // Log the creation
    await prisma.auditLog.create({
      data: {
        workspaceId: workspace.id,
        actorUserId: session.user.id,
        action: "WORKSPACE_CREATED",
        entityType: "WORKSPACE",
        entityId: workspace.id,
        payloadJson: {
          workspaceName: workspace.name,
        },
      },
    });

    return NextResponse.json({ ...workspace, role: WorkspaceRole.OWNER });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    console.error("Failed to create workspace:", error);
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    );
  }
}
