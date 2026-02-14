import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { s3Client } from "@/lib/storage";
import { getEnv } from "@/lib/env";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/uploads/[id]/file
 * Proxy download: serves file from R2 through Next.js, avoiding CORS.
 * Used for image previews, audio/video playback in the dashboard.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: assetId } = await params;

    // Find the asset record
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
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

    // Fetch file from R2
    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: asset.storageKey,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
    }

    // Stream the response body
    const bodyBytes = await response.Body.transformToByteArray();

    return new NextResponse(Buffer.from(bodyBytes), {
      status: 200,
      headers: {
        "Content-Type": asset.mime || "application/octet-stream",
        "Content-Length": String(bodyBytes.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("File proxy error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch file" },
      { status: 500 }
    );
  }
}
