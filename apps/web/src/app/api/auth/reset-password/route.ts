import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePassword } from "@/lib/password";
import { z } from "zod";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is verplicht"),
  code: z.string().length(6, "Code moet 6 cijfers bevatten"),
  password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens bevatten"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const result = resetPasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { token, code, password } = result.data;

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] },
        { status: 400 }
      );
    }

    // Find reset token
    const resetToken = await (prisma as any).passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Ongeldige of verlopen reset link" },
        { status: 400 }
      );
    }

    // Check if token is used
    if (resetToken.used) {
      return NextResponse.json(
        { error: "Deze reset link is al gebruikt" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date() > resetToken.expires) {
      return NextResponse.json(
        { error: "Deze reset link is verlopen" },
        { status: 400 }
      );
    }

    // Check verification code
    if (resetToken.code !== code) {
      return NextResponse.json(
        { error: "Ongeldige verificatiecode" },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user password and mark token as used
    await prisma.$transaction([
      (prisma.user.update as any)({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          emailVerified: resetToken.user.emailVerified || new Date(), // Verify email if not already
        },
      }),
      (prisma as any).passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Wachtwoord is gewijzigd. Je kunt nu inloggen.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Er is iets misgegaan. Probeer het opnieuw." },
      { status: 500 }
    );
  }
}
