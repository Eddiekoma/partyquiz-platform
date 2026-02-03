import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/workspaces/[id]/branding/public - Get workspace branding (public, no auth required)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{  id: string}> }
) {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: (await params).id },
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
