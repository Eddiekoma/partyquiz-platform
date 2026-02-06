import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This proxy runs on Edge Runtime and cannot use the full auth() function
// because nodemailer is not compatible with Edge Runtime.
// Instead, we check for the session cookie directly.
export function proxy(request: NextRequest) {
  // Check for session cookie - Auth.js v5 (NextAuth v5) uses different names based on environment:
  // - Production (HTTPS): __Secure-authjs.session-token
  // - Development (HTTP): authjs.session-token
  // Legacy NextAuth v4 names are also checked for backwards compatibility
  const sessionCookie = 
    request.cookies.get("__Secure-authjs.session-token") ||
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-next-auth.session-token") ||
    request.cookies.get("next-auth.session-token");

  // If no session cookie and trying to access protected routes, redirect to signin
  if (!sessionCookie) {
    const signinUrl = new URL("/auth/signin", request.url);
    signinUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - / (landing page)
     * - /auth/* (auth pages)
     */
    "/dashboard/:path*",
  ],
};
