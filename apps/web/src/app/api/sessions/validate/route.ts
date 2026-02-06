import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Session code is required" },
        { status: 400 }
      );
    }

    // Find active session by code
    const session = await prisma.liveSession.findFirst({
      where: {
        code: code.toUpperCase(),
        // Session must be LOBBY or ACTIVE (not ENDED)
        status: {
          in: ["LOBBY", "ACTIVE"],
        },
      },
      select: {
        id: true,
        code: true,
        status: true,
        quiz: {
          select: {
            title: true,
          },
        },
        workspace: {
          select: {
            name: true,
            logo: true,
            themeColor: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Game not found or has already ended" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      session: {
        code: session.code,
        status: session.status,
        quizTitle: session.quiz.title,
        workspace: session.workspace,
      },
    });
  } catch (error) {
    console.error("Session validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate session" },
      { status: 500 }
    );
  }
}
