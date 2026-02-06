import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasPermission, WorkspaceRole, Permission } from "@/lib/permissions";

/**
 * GET /api/sessions/[id]/export?format=csv
 * 
 * Export session results as CSV file
 * 
 * CSV Format:
 * Player Name, Total Score, Q1 Answer, Q1 Correct, Q1 Points, Q2 Answer, Q2 Correct, Q2 Points, ...
 * 
 * Response: CSV file download
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{  id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sessionId = id;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";

    if (format !== "csv") {
      return NextResponse.json(
        { error: "Only CSV format is supported" },
        { status: 400 }
      );
    }

    // Fetch LiveSession with all data
    const liveSession = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: {
        quiz: {
          include: {
            rounds: {
              include: {
                items: {
                  include: {
                    question: {
                      include: {
                        options: true,
                      },
                    },
                  },
                  orderBy: { order: "asc" },
                },
              },
              orderBy: { order: "asc" },
            },
            workspace: true,
          },
        },
        players: {
          include: {
            answers: {
              select: {
                quizItemId: true,
                payloadJson: true,
                isCorrect: true,
                score: true,
              },
            },
          },
        },
      },
    });

    if (!liveSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check permissions
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: liveSession.quiz.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member || !hasPermission(member.role as WorkspaceRole, Permission.SESSION_VIEW_RESULTS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build question list (all items in order)
    type QuizItemFromDB = NonNullable<typeof liveSession.quiz.rounds[0]["items"][0]>;
    type QuestionFromDB = NonNullable<QuizItemFromDB["question"]>;

    interface QuizItemFlat {
      itemId: string;
      question: QuestionFromDB;
      roundTitle: string;
    }

    const allItems: QuizItemFlat[] = liveSession.quiz.rounds.flatMap((round) =>
      round.items
        .filter((item) => item.question !== null)
        .map((item) => ({
          itemId: item.id,
          question: item.question!,
          roundTitle: round.title,
        }))
    );

    // Build CSV header
    const headers = ["Player Name", "Total Score"];
    allItems.forEach((item, index) => {
      const questionNum = index + 1;
      headers.push(`Q${questionNum} (${item.roundTitle})`);
      headers.push(`Q${questionNum} Correct`);
      headers.push(`Q${questionNum} Points`);
    });

    // Build CSV rows
    const rows: string[][] = [];

    // Calculate total score per player
    interface PlayerWithScore {
      name: string;
      totalScore: number;
      answers: {
        quizItemId: string;
        payloadJson: any;
        isCorrect: boolean | null;
        score: number;
      }[];
    }

    const playersWithScores: PlayerWithScore[] = liveSession.players.map((player) => {
      const totalScore = player.answers.reduce((sum, answer) => sum + answer.score, 0);
      return {
        name: player.name,
        totalScore,
        answers: player.answers,
      };
    });

    // Sort by score descending
    playersWithScores.sort((a, b) => b.totalScore - a.totalScore);

    playersWithScores.forEach((player) => {
      const row: string[] = [
        `"${player.name.replace(/"/g, '""')}"`, // Escape quotes
        player.totalScore.toString(),
      ];

      // Add answer data for each question
      allItems.forEach((item) => {
        const answer = player.answers.find((a) => a.quizItemId === item.itemId);

        if (answer) {
          // Answer value (extract from payloadJson)
          let answerValue = "-";
          if (answer.payloadJson && typeof answer.payloadJson === "object") {
            if ("text" in answer.payloadJson) {
              answerValue = String(answer.payloadJson.text);
            } else if ("optionId" in answer.payloadJson) {
              const option = item.question.options.find(
                (o) => o.id === answer.payloadJson.optionId
              );
              answerValue = option?.text || String(answer.payloadJson.optionId);
            } else if ("optionIds" in answer.payloadJson) {
              const optionTexts = (answer.payloadJson.optionIds as string[])
                .map((id) => {
                  const opt = item.question.options.find((o) => o.id === id);
                  return opt?.text || id;
                })
                .join(", ");
              answerValue = optionTexts || "-";
            }
          }
          row.push(`"${answerValue.replace(/"/g, '""')}"`);

          // Correct/Incorrect
          row.push(answer.isCorrect ? "✓" : "✗");

          // Points earned
          row.push(answer.score.toString());
        } else {
          // No answer submitted
          row.push("-");
          row.push("-");
          row.push("0");
        }
      });

      rows.push(row);
    });

    // Generate CSV content
    const csvLines = [headers.join(","), ...rows.map((row) => row.join(","))];
    const csvContent = csvLines.join("\n");

    // Generate filename
    const timestamp = new Date().toISOString().split("T")[0];
    const sessionCode = liveSession.code || sessionId.slice(0, 6);
    const filename = `session-results-${sessionCode}-${timestamp}.csv`;

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Results export error:", error);
    return NextResponse.json(
      { error: "Failed to export results" },
      { status: 500 }
    );
  }
}
