import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import type { NextAuthConfig } from "next-auth"
import { NextURL } from "next/dist/server/web/next-url"

/**
 * Edge-compatible NextAuth configuration
 * 
 * This file contains ONLY edge-compatible code.
 * NO database imports, NO Prisma, NO nodemailer here!
 * 
 * Used by:
 * - middleware.ts (edge runtime)
 * - auth.ts (extends this with adapter)
 */

// Type for auth object in authorized callback
interface AuthUser {
  user?: {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Authorize is defined in auth.ts (not edge-compatible)
      // This is a placeholder that will be overridden
      authorize: async () => null,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
    newUser: "/dashboard",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }: { auth: AuthUser | null; request: { nextUrl: NextURL } }) {
      const isLoggedIn = !!auth?.user
      const isAuthPage = nextUrl.pathname.startsWith("/auth")
      const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth")
      const isPublicRoute = 
        nextUrl.pathname === "/" || 
        nextUrl.pathname.startsWith("/play") ||
        nextUrl.pathname.startsWith("/healthz") ||
        nextUrl.pathname.startsWith("/_next") ||
        nextUrl.pathname.includes(".")

      // API auth routes are always accessible
      if (isApiAuthRoute) return true

      // Public routes are always accessible
      if (isPublicRoute) return true

      // Auth pages: accessible only when not logged in
      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
        return true
      }

      // Protected routes: require login
      return isLoggedIn
    },
  },
} satisfies NextAuthConfig

export default authConfig
