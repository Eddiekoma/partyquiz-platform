import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { objectExists } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/uploads/[id]/confirm
 * Confirm successful upload and make asset available
 * 
 * This endpoint should be called after the browser successfully
 * uploads the file to S3 using the presigned URL
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assetId = params.id;

    // Find asset
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        workspace: {
          include: {
            members: {
              where: {
                userId: session.user.id,
              },
            },
          },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Check access
    if (asset.workspace.members.length === 0) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Verify file exists in S3
    const exists = await objectExists(asset.storageKey);
    if (!exists) {
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 400 }
      );
    }

    // Asset is confirmed and ready to use
    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        filename: asset.filename,
        storageKey: asset.storageKey,
        mime: asset.mime,
        size: asset.size,
        type: asset.type,
      },
    });
  } catch (error) {
    console.error("Error confirming upload:", error);
    return NextResponse.json(
      { error: "Failed to confirm upload" },
      { status: 500 }
    );
  }
}
