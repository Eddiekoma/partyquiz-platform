import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "./env";

const env = getEnv();

// S3 client - only initialize if credentials are available
export const s3Client = env.S3_ENDPOINT && env.S3_ACCESS_KEY && env.S3_SECRET_KEY && env.S3_BUCKET
  ? new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: true, // Required for Hetzner Object Storage
    })
  : null;

export function getS3Config() {
  if (!env.S3_ENDPOINT || !env.S3_BUCKET) {
    throw new Error("S3 configuration not available. Please set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY environment variables.");
  }
  return {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
  };
}

export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!s3Client || !env.S3_BUCKET) {
    throw new Error("S3 is not configured");
  }
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function generatePresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!s3Client || !env.S3_BUCKET) {
    throw new Error("S3 is not configured");
  }
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export function getPublicUrl(key: string): string {
  if (!env.S3_ENDPOINT || !env.S3_BUCKET) {
    throw new Error("S3 is not configured");
  }
  // For public buckets (not recommended for sensitive data)
  return `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`;
}

/**
 * Check if object exists in S3
 */
export async function objectExists(key: string): Promise<boolean> {
  if (!s3Client || !env.S3_BUCKET) {
    throw new Error("S3 is not configured");
  }
  try {
    const command = new HeadObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Delete object from S3
 */
export async function deleteObject(key: string): Promise<void> {
  if (!s3Client || !env.S3_BUCKET) {
    throw new Error("S3 is not configured");
  }
  const command = new DeleteObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });
  await s3Client.send(command);
}

/**
 * Generate unique storage key for uploaded file
 * Format: workspaces/{workspaceId}/{type}/{timestamp}-{random}-{filename}
 */
export function generateStorageKey(
  workspaceId: string,
  type: "images" | "audio" | "video" | "other",
  filename: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  
  return `workspaces/${workspaceId}/${type}/${timestamp}-${random}-${sanitized}`;
}

/**
 * Validate file size
 * @param size - File size in bytes
 * @param maxSize - Maximum allowed size in bytes (default: 10MB)
 */
export function validateFileSize(size: number, maxSize: number = 10 * 1024 * 1024): boolean {
  return size > 0 && size <= maxSize;
}

/**
 * Validate file type
 * @param mimeType - MIME type
 * @param allowedTypes - Array of allowed MIME types or wildcard patterns (e.g., "image/*")
 */
export function validateFileType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.some((allowed) => {
    if (allowed.endsWith("/*")) {
      const prefix = allowed.slice(0, -2);
      return mimeType.startsWith(prefix);
    }
    return mimeType === allowed;
  });
}

// Allowed MIME types per category
export const ALLOWED_MIME_TYPES = {
  images: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
  audio: ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav"],
  video: ["video/mp4", "video/webm", "video/ogg"],
  documents: ["application/pdf", "text/plain"],
} as const;
