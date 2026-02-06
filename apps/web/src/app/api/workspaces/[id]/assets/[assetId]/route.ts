import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasPermission, WorkspaceRole, Permission, AuditAction, EntityType } from "@/lib/permissions";
import { s3Client } from "@/lib/storage";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{  id: string; assetId: string}> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const assetId = (await params).assetId;

    // Check membership and permissions
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Not a workspace member" }, { status: 403 });
    }

    // Only ADMIN and OWNER can delete assets
    if (!hasPermission(member.role as WorkspaceRole, Permission.ASSET_DELETE)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Get asset
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset || asset.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Delete from S3 (if configured)
    if (s3Client) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: asset.storageKey,
          })
        );
      } catch (s3Error) {
        console.error("Failed to delete from S3:", s3Error);
        // Continue with database deletion even if S3 fails
      }
    }

    // Delete from database
    await prisma.asset.delete({
      where: { id: assetId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: AuditAction.ASSET_DELETED,
        entityType: EntityType.ASSET,
        entityId: assetId,
        payloadJson: JSON.stringify({
          filename: asset.filename,
          type: asset.type,
          size: asset.size,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete asset:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
