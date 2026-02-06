import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, generateVerificationCode, generateResetToken } from "@/lib/email";
import { z } from "zod";
import { getEnv } from "@/lib/env";

const forgotPasswordSchema = z.object({
  email: z.string().email("Ongeldig emailadres"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const result = forgotPasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = result.data;
    const env = getEnv();

    // Find user (don't reveal if user exists)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "Als dit emailadres bij ons bekend is, ontvang je een reset link.",
      });
    }

    // Generate token and code
    const token = generateResetToken();
    const code = generateVerificationCode();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing reset tokens for this user
    await (prisma as any).passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Create new reset token
    await (prisma as any).passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        code,
        expires,
      },
    });

    // Build reset URL
    const baseUrl = env.NEXTAUTH_URL || "https://partyquiz.databridge360.com";
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    // Send email
    await sendPasswordResetEmail(email, code, resetUrl);

    return NextResponse.json({
      success: true,
      message: "Als dit emailadres bij ons bekend is, ontvang je een reset link.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Er is iets misgegaan. Probeer het opnieuw." },
      { status: 500 }
    );
  }
}
