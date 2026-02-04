import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, WorkspaceRole, Permission, AuditAction, EntityType } from "@/lib/permissions";

/**
 * POST /api/workspaces/[id]/questions/export
 * 
 * Export questions as JSON file
 * 
 * Request body (optional):
 * {
 *   questionIds?: string[]  // If provided, export only these questions
 * }
 * 
 * Response: JSON file download
 */
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
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, Permission.QUESTION_VIEW)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { questionIds } = body;

    // Build query
    const where: any = { workspaceId };
    if (questionIds && Array.isArray(questionIds) && questionIds.length > 0) {
      where.id = { in: questionIds };
    }

    // Fetch questions with all relations
    const questions = await prisma.question.findMany({
      where,
      include: {
        options: {
          select: {
            id: true,
            text: true,
            isCorrect: true,
            order: true,
          },
        },
        media: {
          select: {
            id: true,
            provider: true,
            mediaType: true,
            reference: true,
            metadata: true,
            order: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No questions found to export" },
        { status: 404 }
      );
    }

    // Transform questions for export (remove workspace-specific IDs, keep structure)
    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      exportedBy: {
        name: session.user.name,
        email: session.user.email,
      },
      workspace: {
        id: member.workspace.id,
        name: member.workspace.name,
      },
      count: questions.length,
      questions: questions.map((q) => ({
        // Question data (no IDs that would conflict on import)
        type: q.type,
        title: q.title,
        prompt: q.prompt,
        explanation: q.explanation,
        difficulty: q.difficulty,
        tags: JSON.parse(String(q.tagsJson || "[]")),
        status: q.status,
        
        // Options (preserve order, correctness)
        options: q.options.map((opt) => ({
          text: opt.text,
          isCorrect: opt.isCorrect,
          order: opt.order,
        })),
        
        // Media references (preserve provider, type, reference, metadata)
        media: q.media.map((m) => ({
          provider: m.provider,
          mediaType: m.mediaType,
          reference: m.reference,
          metadata: m.metadata,
          order: m.order,
        })),
      })),
    };

    // Log export action
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: session.user.id,
        action: AuditAction.DATA_EXPORTED,
        entityType: EntityType.QUESTION,
        entityId: workspaceId, // Use workspace ID as we're exporting multiple
        payloadJson: {
          questionCount: questions.length,
          questionIds: questionIds || "all",
        },
      },
    });

    // Generate filename
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `questions-export-${member.workspace.name.toLowerCase().replace(/\s+/g, "-")}-${timestamp}.json`;

    // Return JSON file as download
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Questions export error:", error);
    return NextResponse.json(
      { error: "Failed to export questions" },
      { status: 500 }
    );
  }
}
