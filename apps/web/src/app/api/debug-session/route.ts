import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { cookies, headers } from "next/headers";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  console.log("[DEBUG-SESSION] API route called");
  
  try {
    const cookieStore = await cookies();
    const headerStore = await headers();

    const allCookies = cookieStore.getAll();
    const cookieNames = allCookies.map((cookie) => cookie.name);

    const secureToken = cookieStore.get("__Secure-next-auth.session-token")?.value;
    const nonSecureToken = cookieStore.get("next-auth.session-token")?.value;

    console.log("[DEBUG-SESSION] Cookie names:", cookieNames);
    console.log("[DEBUG-SESSION] Secure token present:", !!secureToken);
    console.log("[DEBUG-SESSION] Non-secure token present:", !!nonSecureToken);
    
    console.log("[DEBUG-SESSION] Calling getServerSession...");
    const session = await getServerSession(authOptions);
    console.log("[DEBUG-SESSION] Session result:", session);
    
    return NextResponse.json({
      env: {
        nodeEnv: process.env.NODE_ENV,
        nextAuthUrl: process.env.NEXTAUTH_URL,
      },
      request: {
        host: headerStore.get("host"),
        xForwardedProto: headerStore.get("x-forwarded-proto"),
      },
      cookieNames,
      secureTokenPresent: !!secureToken,
      nonSecureTokenPresent: !!nonSecureToken,
      sessionPresent: !!session,
      session: session ? {
        userId: session.user?.id,
        email: session.user?.email,
        name: session.user?.name,
      } : null,
    });
  } catch (error) {
    console.error("[DEBUG-SESSION] Error:", error);
    return NextResponse.json({
      error: String(error),
    }, { status: 500 });
  }
}
