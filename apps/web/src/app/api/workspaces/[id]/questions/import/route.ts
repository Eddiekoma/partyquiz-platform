import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasPermission, WorkspaceRole, Permission, AuditAction, EntityType } from "@/lib/permissions";
import { z } from "zod";

/**
 * POST /api/workspaces/[id]/questions/import
 * 
 * Import questions from JSON file
 * 
 * Request body:
 * {
 *   data: {
 *     version: "1.0",
 *     questions: [...]
 *   },
 *   options?: {
 *     skipDuplicates?: boolean  // Default: true
 *   }
 * }
 * 
 * Response: { imported: number, skipped: number, errors: string[] }
 */

// Validation schema for import
const questionImportSchema = z.object({
  type: z.string(),
  title: z.string().min(1),
  prompt: z.string().min(1),
  explanation: z.string().optional().nullable(),
  difficulty: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  options: z.array(z.object({
    text: z.string(),
    isCorrect: z.boolean(),
    order: z.number().int(),
  })).optional(),
  media: z.array(z.object({
    provider: z.string(),
    mediaType: z.string(),
    reference: z.any(),
    metadata: z.any().optional(),
    order: z.number().int(),
  })).optional(),
});

const importDataSchema = z.object({
  version: z.string(),
  questions: z.array(questionImportSchema),
});

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

    // Parse request body
    const body = await request.json();
    const { data, options } = body;
    const skipDuplicates = options?.skipDuplicates !== false; // Default: true

    // Validate import data
    const validation = importDataSchema.safeParse(data);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid import data format", details: validation.error.issues },
        { status: 400 }
      );
    }

    const importData = validation.data;
    
    if (importData.questions.length === 0) {
      return NextResponse.json(
        { error: "No questions to import" },
        { status: 400 }
      );
    }

    // Check version compatibility
    if (importData.version !== "1.0") {
      return NextResponse.json(
        { error: `Unsupported import version: ${importData.version}` },
        { status: 400 }
      );
    }

    // Import questions
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const questionData of importData.questions) {
      try {
        // Check for duplicates (same title + prompt in workspace)
        if (skipDuplicates) {
          const existing = await prisma.question.findFirst({
            where: {
              workspaceId,
              title: questionData.title,
              prompt: questionData.prompt,
            },
          });

          if (existing) {
            skipped++;
            continue;
          }
        }

        // Create question with options and media
        await prisma.question.create({
          data: {
            workspaceId,
            type: questionData.type,
            title: questionData.title,
            prompt: questionData.prompt,
            explanation: questionData.explanation || null,
            difficulty: questionData.difficulty || 3,
            tagsJson: JSON.stringify(questionData.tags || []),
            status: questionData.status || "DRAFT",
            createdBy: session.user.id,
            
            // Create options if present
            options: questionData.options && questionData.options.length > 0 ? {
              create: questionData.options.map((opt) => ({
                text: opt.text,
                isCorrect: opt.isCorrect,
                order: opt.order,
              })),
            } : undefined,
            
            // Create media if present
            media: questionData.media && questionData.media.length > 0 ? {
              create: questionData.media.map((m) => ({
                provider: m.provider,
                mediaType: m.mediaType,
                reference: m.reference,
                metadata: m.metadata || null,
                order: m.order,
              })),
            } : undefined,
          },
        });

        imported++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to import question "${questionData.title}": ${errorMsg}`);
        console.error(`Import error for question "${questionData.title}":`, error);
      }
    }

    // Log import action
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: AuditAction.DATA_IMPORTED,
        entityType: EntityType.QUESTION,
        entityId: workspaceId,
        payloadJson: {
          total: importData.questions.length,
          imported,
          skipped,
          errorsCount: errors.length,
          skipDuplicates,
        },
      },
    });

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
      message: `Successfully imported ${imported} question(s)${skipped > 0 ? `, skipped ${skipped} duplicate(s)` : ""}${errors.length > 0 ? `, ${errors.length} error(s)` : ""}`,
    });
  } catch (error) {
    console.error("Questions import error:", error);
    return NextResponse.json(
      { error: "Failed to import questions" },
      { status: 500 }
    );
  }
}
