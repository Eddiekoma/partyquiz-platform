import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This middleware runs on Edge Runtime and cannot use the full auth() function
// because nodemailer is not compatible with Edge Runtime.
// Instead, we check for the session cookie directly.
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("authjs.session-token");

  // If no session cookie and trying to access protected routes, redirect to signin
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
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
