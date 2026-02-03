import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission, WorkspaceRole } from "@/lib/permissions";
import { z } from "zod";

// POST /api/workspaces/:id/questions/:questionId/media - Attach media to question
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; questionId: string}> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const questionId = (await params).questionId;

    // Check workspace membership and permission
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (!hasPermission(membership.role as WorkspaceRole, Permission.QUESTION_UPDATE)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Verify question belongs to this workspace
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { media: true },
    });

    if (!question || question.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Parse request body
    const bodySchema = z.object({
      provider: z.enum(["UPLOAD", "SPOTIFY", "YOUTUBE"]),
      mediaType: z.enum(["IMAGE", "AUDIO", "VIDEO"]),
      assetId: z.string().optional(), // For UPLOAD provider
      spotifyTrackId: z.string().optional(), // For SPOTIFY provider
      youtubeVideoId: z.string().optional(), // For YOUTUBE provider
      startTime: z.number().optional(), // For MUSIC_SNIPPET or video clips
      endTime: z.number().optional(),
      order: z.number().optional(),
    });

    const body = await req.json();
    const data = bodySchema.parse(body);

    // Build reference JSON based on provider
    let reference: any = {};
    if (data.provider === "UPLOAD" && data.assetId) {
      // Verify asset exists and belongs to workspace
      const asset = await prisma.asset.findUnique({
        where: { id: data.assetId },
      });

      if (!asset || asset.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }

      reference = {
        assetId: data.assetId,
        storageKey: asset.storageKey,
        filename: asset.filename,
      };
    } else if (data.provider === "SPOTIFY" && data.spotifyTrackId) {
      reference = {
        trackId: data.spotifyTrackId,
        startTime: data.startTime,
        endTime: data.endTime,
      };
    } else if (data.provider === "YOUTUBE" && data.youtubeVideoId) {
      reference = {
        videoId: data.youtubeVideoId,
        startTime: data.startTime,
        endTime: data.endTime,
      };
    } else {
      return NextResponse.json(
        { error: "Missing required reference data for provider" },
        { status: 400 }
      );
    }

    // Determine order (append to end if not specified)
    const order = data.order ?? question.media.length;

    // Create QuestionMedia record
    const questionMedia = await prisma.questionMedia.create({
      data: {
        questionId,
        provider: data.provider,
        mediaType: data.mediaType,
        reference,
        metadata: {}, // Can be extended with duration, dimensions, etc.
        order,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: "UPDATE",
        entityType: "QUESTION",
        entityId: questionId,
        payloadJson: {
          action: "ATTACH_MEDIA",
          mediaId: questionMedia.id,
          provider: data.provider,
          mediaType: data.mediaType,
        },
      },
    });

    return NextResponse.json({
      success: true,
      media: questionMedia,
    });
  } catch (error) {
    console.error("Error attaching media to question:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/workspaces/:id/questions/:questionId/media - Remove all media or specific media
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{  id: string; questionId: string}> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const questionId = (await params).questionId;

    // Check workspace membership and permission
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (!hasPermission(membership.role as WorkspaceRole, Permission.QUESTION_UPDATE)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Verify question belongs to this workspace
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question || question.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Check if specific media ID is provided in query params
    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get("mediaId");

    if (mediaId) {
      // Delete specific media
      const media = await prisma.questionMedia.findUnique({
        where: { id: mediaId },
      });

      if (!media || media.questionId !== questionId) {
        return NextResponse.json({ error: "Media not found" }, { status: 404 });
      }

      await prisma.questionMedia.delete({
        where: { id: mediaId },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: session.user.id,
          action: "UPDATE",
          entityType: "QUESTION",
          entityId: questionId,
          payloadJson: {
            action: "DETACH_MEDIA",
            mediaId,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Media detached from question",
      });
    } else {
      // Delete all media for this question
      const deletedCount = await prisma.questionMedia.deleteMany({
        where: { questionId },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: session.user.id,
          action: "UPDATE",
          entityType: "QUESTION",
          entityId: questionId,
          payloadJson: {
            action: "DETACH_ALL_MEDIA",
            count: deletedCount.count,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: `${deletedCount.count} media item(s) detached`,
      });
    }
  } catch (error) {
    console.error("Error detaching media from question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
