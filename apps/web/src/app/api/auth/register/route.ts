import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePassword } from "@/lib/password";
import { sendVerificationEmail, generateVerificationCode } from "@/lib/email";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Ongeldig emailadres"),
  password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens bevatten"),
  name: z.string().min(2, "Naam moet minimaal 2 tekens bevatten").optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const result = registerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, name } = result.data;

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      // If user exists and is verified, don't reveal this for security
      if (existingUser.emailVerified) {
        return NextResponse.json(
          { error: "Er is al een account met dit emailadres. Probeer in te loggen." },
          { status: 400 }
        );
      }

      // User exists but not verified - update with new verification code
      const code = generateVerificationCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await (prisma.user.update as any)({
        where: { id: existingUser.id },
        data: {
          passwordHash: await hashPassword(password),
          name: name || existingUser.name,
          emailVerifyCode: code,
          emailVerifyExpires: expires,
        },
      });

      await sendVerificationEmail(email, code, name);

      return NextResponse.json({
        success: true,
        message: "Verificatiecode verzonden naar je email",
        email: email.toLowerCase(),
      });
    }

    // Create new user
    const code = generateVerificationCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const passwordHash = await hashPassword(password);

    await (prisma.user.create as any)({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        emailVerifyCode: code,
        emailVerifyExpires: expires,
      },
    });

    // Send verification email
    await sendVerificationEmail(email, code, name);

    return NextResponse.json({
      success: true,
      message: "Account aangemaakt! Verificatiecode verzonden naar je email",
      email: email.toLowerCase(),
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Er is iets misgegaan. Probeer het opnieuw." },
      { status: 500 }
    );
  }
}
