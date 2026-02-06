import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  console.log("[DEBUG-SESSION] API route called");
  
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    console.log("[DEBUG-SESSION] Cookies:", allCookies.map(c => `${c.name}=${c.value?.substring(0, 30)}...`));
    
    const secureToken = cookieStore.get("__Secure-next-auth.session-token");
    const nonSecureToken = cookieStore.get("next-auth.session-token");
    
    console.log("[DEBUG-SESSION] Secure token:", secureToken?.value?.substring(0, 30));
    console.log("[DEBUG-SESSION] Non-secure token:", nonSecureToken?.value?.substring(0, 30));
    
    console.log("[DEBUG-SESSION] Calling getServerSession...");
    const session = await getServerSession(authOptions);
    console.log("[DEBUG-SESSION] Session result:", session);
    
    return NextResponse.json({
      cookies: allCookies.map(c => ({ name: c.name, valuePreview: c.value?.substring(0, 30) })),
      secureTokenPresent: !!secureToken?.value,
      nonSecureTokenPresent: !!nonSecureToken?.value,
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
