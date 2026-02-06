import { NextResponse } from "next/server";

/**
 * Debug endpoint to check auth configuration
 * REMOVE THIS IN PRODUCTION after debugging!
 */
export async function GET() {
  const config = {
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    googleClientIdLength: process.env.GOOGLE_CLIENT_ID?.length ?? 0,
    googleClientIdPreview: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + "..." || "NOT SET",
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    googleClientSecretLength: process.env.GOOGLE_CLIENT_SECRET?.length ?? 0,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    nextAuthSecretLength: process.env.NEXTAUTH_SECRET?.length ?? 0,
    nextAuthUrl: process.env.NEXTAUTH_URL ?? "NOT SET",
    authUrl: process.env.AUTH_URL ?? "NOT SET",
    nodeEnv: process.env.NODE_ENV,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
  };

  return NextResponse.json(config, { status: 200 });
}
