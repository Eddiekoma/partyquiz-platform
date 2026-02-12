import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const verifySchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().length(6, "Code must contain 6 digits"),
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
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email is already verified. You can log in." },
        { status: 400 }
      );
    }

    // Check verification code
    if (!(user as any).emailVerifyCode || !(user as any).emailVerifyExpires) {
      return NextResponse.json(
        { error: "No verification code found. Request a new one." },
        { status: 400 }
      );
    }

    if ((user as any).emailVerifyCode !== code) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    if (new Date() > (user as any).emailVerifyExpires) {
      return NextResponse.json(
        { error: "Verification code has expired. Request a new one." },
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
      message: "Email verified! You can now log in.",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
