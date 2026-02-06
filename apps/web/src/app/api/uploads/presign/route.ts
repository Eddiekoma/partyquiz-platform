import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { 
  generatePresignedUploadUrl, 
  generateStorageKey, 
  validateFileSize, 
  validateFileType,
  ALLOWED_MIME_TYPES 
} from "@/lib/storage";
import { hasPermission, Permission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/uploads/presign
 * Generate presigned upload URL for direct browser upload
 * 
 * Body:
 * {
 *   workspaceId: string;
 *   filename: string;
 *   contentType: string;
 *   size: number;
 *   category?: "images" | "audio" | "video" | "other";
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { workspaceId, filename, contentType, size, category = "images" } = body;

    // Validate required fields
    if (!workspaceId || !filename || !contentType || !size) {
      return NextResponse.json(
        { error: "Missing required fields: workspaceId, filename, contentType, size" },
        { status: 400 }
      );
    }

    // Check workspace membership and permissions
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: session.user.id,
        workspaceId,
      },
      include: {
        workspace: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Workspace not found or access denied" },
        { status: 403 }
      );
    }

    // Check permissions (CONTRIBUTOR or higher can upload)
    if (!hasPermission(membership.role as any, Permission.ASSET_UPLOAD)) {
      return NextResponse.json(
        { error: "Insufficient permissions to upload files" },
        { status: 403 }
      );
    }

    // Validate file size (10MB max by default)
    const maxSize = category === "video" ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB for video, 10MB for others
    if (!validateFileSize(size, maxSize)) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ALLOWED_MIME_TYPES[category as keyof typeof ALLOWED_MIME_TYPES] || [];
    if (!validateFileType(contentType, [...allowedTypes])) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed types for ${category}: ${allowedTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Generate unique storage key
    const storageKey = generateStorageKey(workspaceId, category, filename);

    // Generate presigned URL (valid for 5 minutes)
    const uploadUrl = await generatePresignedUploadUrl(storageKey, contentType, 300);

    // Create asset record in database (status: pending until upload confirmed)
    const asset = await prisma.asset.create({
      data: {
        workspaceId,
        createdBy: session.user.id,
        filename,
        storageKey,
        mime: contentType,
        size,
        type: category.toUpperCase(),
      },
    });

    return NextResponse.json({
      assetId: asset.id,
      uploadUrl,
      storageKey,
      expiresIn: 300, // seconds
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
