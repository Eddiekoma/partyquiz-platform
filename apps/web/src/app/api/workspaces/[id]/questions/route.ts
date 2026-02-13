import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasPermission, WorkspaceRole, Permission, AuditAction, EntityType } from "@/lib/permissions";
import { z } from "zod";

// Validation schema - adapted to existing Prisma schema
const createQuestionSchema = z.object({
  type: z.enum([
    // Text-based variants
    "MC_SINGLE",
    "MC_MULTIPLE",
    "TRUE_FALSE",
    "OPEN_TEXT",
    "NUMERIC",
    "SLIDER",
    "ORDER",
    "MC_ORDER",
    // Photo variants
    "PHOTO_MC_SINGLE",
    "PHOTO_MC_MULTIPLE",
    "PHOTO_TRUE_FALSE",
    "PHOTO_OPEN_TEXT",
    "PHOTO_NUMERIC",
    "PHOTO_SLIDER",
    "PHOTO_MC_ORDER",
    // Audio/Video variants
    "AUDIO_QUESTION",
    "AUDIO_OPEN",
    "VIDEO_QUESTION",
    "VIDEO_OPEN",
    // Music variants
    "MUSIC_INTRO",
    "MUSIC_SNIPPET",
    "MUSIC_GUESS_TITLE",
    "MUSIC_GUESS_ARTIST",
    "MUSIC_GUESS_YEAR",
    // Other types
    "POLL",
    "YOUTUBE_WHO_SAID_IT",
    "YOUTUBE_SCENE_QUESTION",
    "YOUTUBE_NEXT_LINE",
    // Legacy types (backward compatibility)
    "ESTIMATION",
  ]),
  title: z.string().min(1, "Title is required"),
  prompt: z.string().optional(), // Made optional since some question types may not need it
  explanation: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  questionSetId: z.string().optional(), // Question Set ID
  options: z.array(z.object({
    text: z.string(),
    isCorrect: z.boolean(),
    order: z.number().optional(),
  })).optional(),
  // Media fields
  spotifyTrackId: z.string().optional(),
  youtubeVideoId: z.string().optional(),
  mediaUrl: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{  id: string}> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;
    const { searchParams } = new URL(request.url);

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

    // Parse filters
    const type = searchParams.get("type");
    const difficulty = searchParams.get("difficulty");
    const status = searchParams.get("status");
    const tag = searchParams.get("tag");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // Build where clause
    const where: any = { workspaceId };
    
    if (type) where.type = type;
    if (difficulty) where.difficulty = parseInt(difficulty);
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { prompt: { contains: search, mode: "insensitive" } },
        { explanation: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get questions with pagination
    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          options: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.question.count({ where }),
    ]);

    // Get unique tags for filters
    const allQuestions = await prisma.question.findMany({
      where: { workspaceId },
      select: { tagsJson: true },
    });
    const uniqueTags = Array.from(
      new Set(
        allQuestions.flatMap((q: { tagsJson: any }) =>
          Array.isArray(q.tagsJson) ? q.tagsJson : JSON.parse(q.tagsJson as string)
        )
      )
    ).sort();

    return NextResponse.json({
      questions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        availableTags: uniqueTags,
      },
    });
  } catch (error) {
    console.error("Failed to list questions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{  id: string}> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (await params).id;

    // Check membership and permissions
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, Permission.QUESTION_CREATE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse and validate request
    const body = await request.json();
    const data = createQuestionSchema.parse(body);

    // Build media entries if any media is provided
    const mediaEntries: Array<{
      provider: string;
      mediaType: string;
      reference: object;
      order: number;
      metadata?: object;
    }> = [];

    if (data.spotifyTrackId) {
      mediaEntries.push({
        provider: "SPOTIFY",
        mediaType: "AUDIO",
        reference: { trackId: data.spotifyTrackId },
        order: mediaEntries.length,
      });
    }

    if (data.youtubeVideoId) {
      mediaEntries.push({
        provider: "YOUTUBE",
        mediaType: "VIDEO",
        reference: { videoId: data.youtubeVideoId },
        order: mediaEntries.length,
      });
    }

    if (data.mediaUrl) {
      // Determine media type based on question type
      let mediaType = "IMAGE";
      if (data.type.includes("AUDIO")) mediaType = "AUDIO";
      if (data.type.includes("VIDEO")) mediaType = "VIDEO";
      
      mediaEntries.push({
        provider: "UPLOAD",
        mediaType,
        reference: { storageKey: data.mediaUrl },
        order: mediaEntries.length,
      });
    }

    // Create question with options and media
    const question = await prisma.question.create({
      data: {
        workspaceId,
        questionSetId: data.questionSetId || null,
        type: data.type,
        title: data.title,
        prompt: data.prompt || "",
        explanation: data.explanation,
        difficulty: data.difficulty || 3,
        tagsJson: JSON.stringify(data.tags || []),
        status: data.status || "DRAFT",
        createdBy: session.user.id,
        updatedBy: session.user.id,
        options: data.options
          ? {
              create: data.options.map((opt, index) => ({
                text: opt.text,
                isCorrect: opt.isCorrect,
                order: opt.order ?? index,
              })),
            }
          : undefined,
        media: mediaEntries.length > 0
          ? {
              create: mediaEntries,
            }
          : undefined,
      },
      include: {
        creator: {
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

    // Audit log
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: AuditAction.QUESTION_CREATED,
        entityType: EntityType.QUESTION,
        entityId: question.id,
        payloadJson: JSON.stringify({
          type: question.type,
          title: question.title.substring(0, 100),
          status: question.status,
        }),
      },
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    console.error("Failed to create question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
