import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasPermission, WorkspaceRole, Permission, AuditAction, EntityType } from "@/lib/permissions";
import { z } from "zod";

const updateQuestionSchema = z.object({
  type: z.enum([
    "MC_SINGLE",
    "MC_MULTIPLE",
    "TRUE_FALSE",
    "OPEN_TEXT",
    "ESTIMATION",
    "ORDER",
    "PHOTO_QUESTION",
    "AUDIO_QUESTION",
    "VIDEO_QUESTION",
    "MUSIC_INTRO",
    "MUSIC_SNIPPET",
    "MUSIC_GUESS_TITLE",
    "MUSIC_GUESS_ARTIST",
    "MUSIC_GUESS_YEAR",
    "POLL",
    "PHOTO_OPEN",
    "AUDIO_OPEN",
    "VIDEO_OPEN",
    "YOUTUBE_SCENE_QUESTION",
    "YOUTUBE_NEXT_LINE",
    "YOUTUBE_WHO_SAID_IT",
  ]).optional(),
  title: z.string().min(1).optional(),
  prompt: z.string().optional(),
  explanation: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  tags: z.array(z.string()).optional(),
  options: z.array(z.object({
    text: z.string(),
    isCorrect: z.boolean(),
    order: z.number().int(),
  })).optional(),
  spotifyTrackId: z.string().nullable().optional(),
  youtubeVideoId: z.string().nullable().optional(),
  settingsJson: z.record(z.any()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{  id: string; questionId: string}> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const questionId = (await params).questionId;

    // Check membership and permissions
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, Permission.QUESTION_VIEW)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get question
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        options: true,
        media: true,
      },
    });

    if (!question || question.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json({ question });
  } catch (error) {
    console.error("Failed to get question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{  id: string; questionId: string}> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const questionId = (await params).questionId;

    // Check membership and permissions
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, Permission.QUESTION_UPDATE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if question exists
    const existingQuestion = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!existingQuestion || existingQuestion.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Parse and validate request
    const body = await request.json();
    console.log("[API] PUT question - Incoming body:", JSON.stringify(body, null, 2));
    const { tags, options, settingsJson, ...rest } = updateQuestionSchema.parse(body);
    console.log("[API] PUT question - Parsed rest:", JSON.stringify(rest, null, 2));

    // Build update data
    const updateData: any = {
      ...rest,
      updater: {
        connect: { id: session.user.id }
      },
    };

    if (tags) {
      updateData.tagsJson = JSON.stringify(tags);
    }

    if (settingsJson !== undefined) {
      updateData.settingsJson = settingsJson;
    }

    console.log("[API] PUT question - Update data:", JSON.stringify(updateData, null, 2));

    // Update question with options
    const question = await prisma.question.update({
      where: { id: questionId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        options: true,
        media: true,
      },
    });

    // Update options if provided
    if (options) {
      // Delete existing options
      await prisma.questionOption.deleteMany({
        where: { questionId },
      });
      // Create new options
      await prisma.questionOption.createMany({
        data: options.map(opt => ({
          questionId,
          text: opt.text,
          isCorrect: opt.isCorrect,
          order: opt.order,
        })),
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: AuditAction.QUESTION_UPDATED,
        entityType: EntityType.QUESTION,
        entityId: questionId,
        payloadJson: JSON.stringify({
          type: question.type,
          status: question.status,
          changes: Object.keys(updateData),
        }),
      },
    });

    return NextResponse.json({ question });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    console.error("Failed to update question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{  id: string; questionId: string}> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const questionId = (await params).questionId;

    // Check membership and permissions
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, Permission.QUESTION_DELETE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if question exists
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question || question.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Delete question
    await prisma.question.delete({
      where: { id: questionId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: AuditAction.QUESTION_DELETED,
        entityType: EntityType.QUESTION,
        entityId: questionId,
        payloadJson: JSON.stringify({
          type: question.type,
          title: question.title.substring(0, 100),
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
