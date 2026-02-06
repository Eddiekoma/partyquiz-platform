import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const verifySchema = z.object({
  email: z.string().email("Ongeldig emailadres"),
  code: z.string().length(6, "Code moet 6 cijfers bevatten"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const result = verifySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, code } = result.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Gebruiker niet gevonden" },
        { status: 404 }
      );
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email is al geverifieerd. Je kunt inloggen." },
        { status: 400 }
      );
    }

    // Check verification code
    if (!(user as any).emailVerifyCode || !(user as any).emailVerifyExpires) {
      return NextResponse.json(
        { error: "Geen verificatiecode gevonden. Vraag een nieuwe aan." },
        { status: 400 }
      );
    }

    if ((user as any).emailVerifyCode !== code) {
      return NextResponse.json(
        { error: "Ongeldige verificatiecode" },
        { status: 400 }
      );
    }

    if (new Date() > (user as any).emailVerifyExpires) {
      return NextResponse.json(
        { error: "Verificatiecode is verlopen. Vraag een nieuwe aan." },
        { status: 400 }
      );
    }

    // Verify user
    await (prisma.user.update as any)({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerifyCode: null,
        emailVerifyExpires: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Email geverifieerd! Je kunt nu inloggen.",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json(
      { error: "Er is iets misgegaan. Probeer het opnieuw." },
      { status: 500 }
    );
  }
}
