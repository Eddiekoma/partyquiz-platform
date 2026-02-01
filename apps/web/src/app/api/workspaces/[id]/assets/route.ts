import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generatePresignedDownloadUrl, getPublicUrl } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = params.id;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || undefined;

    // Check membership
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Not a workspace member" }, { status: 403 });
    }

    // Get assets
    const assets = await prisma.asset.findMany({
      where: { 
        workspaceId,
        ...(type && { type }),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Generate URLs for each asset
    const assetsWithUrls = await Promise.all(
      assets.map(async (asset) => {
        try {
          // Try presigned URL first (for private buckets)
          const url = await generatePresignedDownloadUrl(asset.storageKey, 3600);
          return { ...asset, url };
        } catch {
          // Fallback to public URL
          return { ...asset, url: getPublicUrl(asset.storageKey) };
        }
      })
    );

    return NextResponse.json({ assets: assetsWithUrls });
  } catch (error) {
    console.error("Failed to list assets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
