import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { s3Client } from "@/lib/storage";
import { getEnv } from "@/lib/env";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PUT /api/uploads/[id]/upload
 * Proxy upload: receives file from browser and uploads to R2 server-side.
 * This avoids CORS issues with direct browser-to-R2 uploads.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: assetId } = await params;

    // Find the asset record (created during presign)
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { workspace: true },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Verify user belongs to the workspace
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: session.user.id,
        workspaceId: asset.workspaceId,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!s3Client) {
      return NextResponse.json(
        { error: "S3 storage is not configured" },
        { status: 503 }
      );
    }

    const env = getEnv();

    // Read the file body from the request
    const body = await req.arrayBuffer();

    // Upload to R2/S3 server-side
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: asset.storageKey,
      ContentType: asset.mime,
      Body: Buffer.from(body),
    });

    await s3Client.send(command);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Proxy upload error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
