import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { s3Client, getS3Config } from "@/lib/storage";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { randomBytes } from "crypto";

// File type validation
const ALLOWED_TYPES = {
  image: [
    "image/jpeg", 
    "image/jpg",
    "image/png", 
    "image/gif", 
    "image/webp",
    "image/avif",
    "image/svg+xml",
    "image/bmp",
    "image/tiff"
  ],
  audio: ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-m4a"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
} as const;

const SIZE_LIMITS = {
  image: 15 * 1024 * 1024, // 15MB (increased for high-res photos)
  audio: 50 * 1024 * 1024, // 50MB
  video: 200 * 1024 * 1024, // 200MB
} as const;

// Minimum dimensions for image quality
const MIN_IMAGE_DIMENSIONS = {
  width: 400, // Min 400px wide for photo questions
  height: 200, // Min 200px tall
} as const;

const uploadRequestSchema = z.object({
  workspaceId: z.string().cuid(),
  filename: z.string().min(1).max(255),
  contentType: z.string(),
  size: z.number().positive(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  duration: z.number().positive().optional(),
});

function getAssetType(contentType: string): "IMAGE" | "AUDIO" | "VIDEO" | null {
  if (ALLOWED_TYPES.image.includes(contentType as any)) return "IMAGE";
  if (ALLOWED_TYPES.audio.includes(contentType as any)) return "AUDIO";
  if (ALLOWED_TYPES.video.includes(contentType as any)) return "VIDEO";
  return null;
}

function validateFileSize(type: "IMAGE" | "AUDIO" | "VIDEO", size: number): boolean {
  const limit = SIZE_LIMITS[type.toLowerCase() as keyof typeof SIZE_LIMITS];
  return size <= limit;
}

// POST /api/media/upload - Generate presigned URL for upload
export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if S3 is configured
  if (!s3Client) {
    return NextResponse.json(
      { error: "Media upload is not configured. Please contact your administrator." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const data = uploadRequestSchema.parse(body);

    // Check if user is a member of the workspace
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: data.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate file type
    const assetType = getAssetType(data.contentType);
    if (!assetType) {
      return NextResponse.json(
        { error: "Unsupported file type. Supported: JPG, PNG, GIF, WebP, AVIF, SVG" },
        { status: 400 }
      );
    }

    // Validate image dimensions (for photo questions)
    if (assetType === "IMAGE" && data.width && data.height) {
      if (data.width < MIN_IMAGE_DIMENSIONS.width) {
        return NextResponse.json(
          { error: `Image too small. Minimum width: ${MIN_IMAGE_DIMENSIONS.width}px` },
          { status: 400 }
        );
      }
      if (data.height < MIN_IMAGE_DIMENSIONS.height) {
        return NextResponse.json(
          { error: `Image too small. Minimum height: ${MIN_IMAGE_DIMENSIONS.height}px` },
          { status: 400 }
        );
      }
    }

    // Validate file size
    if (!validateFileSize(assetType, data.size)) {
      const limitMB = SIZE_LIMITS[assetType.toLowerCase() as keyof typeof SIZE_LIMITS] / (1024 * 1024);
      return NextResponse.json(
        { error: `File too large. Maximum size: ${limitMB}MB` },
        { status: 400 }
      );
    }

    // Generate unique storage key
    const fileExt = data.filename.split(".").pop() || "";
    const randomId = randomBytes(16).toString("hex");
    const storageKey = `${data.workspaceId}/${assetType.toLowerCase()}/${randomId}.${fileExt}`;

    // Create Asset record
    const asset = await prisma.asset.create({
      data: {
        workspaceId: data.workspaceId,
        filename: data.filename,
        type: assetType,
        storageKey,
        mime: data.contentType,
        size: data.size,
        width: data.width,
        height: data.height,
        duration: data.duration,
        createdBy: session.user.id,
      },
    });

    // Generate presigned URL
    const s3Config = getS3Config();
    const command = new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: storageKey,
      ContentType: data.contentType,
      Metadata: {
        assetId: asset.id,
        workspaceId: data.workspaceId,
        uploadedBy: session.user.id,
      },
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    // Log the upload
    await prisma.auditLog.create({
      data: {
        workspaceId: data.workspaceId,
        actorUserId: session.user.id,
        action: "ASSET_UPLOADED",
        entityType: "ASSET",
        entityId: asset.id,
        payloadJson: {
          filename: data.filename,
          type: assetType,
          size: data.size,
        },
      },
    });

    return NextResponse.json({
      assetId: asset.id,
      uploadUrl: presignedUrl,
      storageKey,
      publicUrl: `${s3Config.endpoint}/${s3Config.bucket}/${storageKey}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error("Failed to generate upload URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
