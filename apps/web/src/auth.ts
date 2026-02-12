import NextAuth, { CredentialsSignin } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import Nodemailer from "next-auth/providers/nodemailer"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password"
import authConfig from "./auth.config"

/**
 * Custom error class for credentials signin that preserves the error code
 */
class CustomCredentialsError extends CredentialsSignin {
  constructor(code: string) {
    super()
    this.code = code
  }
}

/**
 * Custom error codes for credentials signin
 * These codes are passed to the error query parameter and can be mapped to user-friendly messages
 */
const AUTH_ERROR = {
  MISSING_CREDENTIALS: "email_password_required",
  USER_NOT_FOUND: "user_not_found", 
  NO_PASSWORD_SET: "no_password_set", // Account exists but has no password (needs to set one first)
  EMAIL_NOT_VERIFIED: "email_not_verified",
  INVALID_PASSWORD: "invalid_password",
} as const

/**
 * Full NextAuth configuration with database adapter
 * 
 * This file is used in server-side code (NOT in middleware/edge).
 * It includes the Prisma adapter and all non-edge-compatible code.
 */

// Validate Google OAuth credentials at startup
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

if (!googleClientId || !googleClientSecret) {
  console.warn("[Auth] Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing");
}

// Build providers array with full authorize function
const providers: any[] = [];

// Only add Google provider if credentials are configured
if (googleClientId && googleClientSecret) {
  providers.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

providers.push(
  Credentials({
    id: "credentials",
    name: "Email & Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new CustomCredentialsError(AUTH_ERROR.MISSING_CREDENTIALS)
      }

      const email = (credentials.email as string).toLowerCase()
      const password = credentials.password as string

      // Explicitly select passwordHash since it's needed for authentication
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          emailVerified: true,
          passwordHash: true,
          accounts: {
            select: { provider: true }
          }
        }
      })

      if (!user) {
        throw new CustomCredentialsError(AUTH_ERROR.USER_NOT_FOUND)
      }

      // Check if user has a password set
      if (!user.passwordHash) {
        // User exists but has no password (e.g., signed up via Google)
        // They need to set a password first via account settings
        throw new CustomCredentialsError(AUTH_ERROR.NO_PASSWORD_SET)
      }

      // For OAuth accounts, email is already verified via the provider
      // For credentials-only accounts, check email verification
      const hasOAuthAccount = user.accounts.length > 0
      if (!hasOAuthAccount && !user.emailVerified) {
        throw new CustomCredentialsError(AUTH_ERROR.EMAIL_NOT_VERIFIED)
      }

      const isValid = await verifyPassword(password, user.passwordHash)
      if (!isValid) {
        throw new CustomCredentialsError(AUTH_ERROR.INVALID_PASSWORD)
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      }
    },
  })
);

// Add Nodemailer provider for magic links if configured
if (process.env.EMAIL_SMTP_HOST && process.env.EMAIL_SMTP_USER && process.env.EMAIL_SMTP_PASS && process.env.EMAIL_FROM) {
  providers.push(
    Nodemailer({
      server: {
        host: process.env.EMAIL_SMTP_HOST,
        port: parseInt(process.env.EMAIL_SMTP_PORT || "587"),
        auth: {
          user: process.env.EMAIL_SMTP_USER,
          pass: process.env.EMAIL_SMTP_PASS,
        },
      },
      from: process.env.EMAIL_FROM,
    }) as any
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET || "temp-build-secret-change-in-production",
  trustHost: true, // Required for localhost/reverse proxy
  // Use pages from authConfig but NOT providers (we define our own with full authorize)
  pages: authConfig.pages,
  providers,
  cookies: {
    // Explicit cookie configuration for localhost compatibility
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    // Don't spread authConfig.callbacks - the authorized callback belongs in middleware only
    async jwt({ token, user }) {
      // Initial sign in - add user id to token
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      // Add user id from token to session
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
    async signIn({ user, account }) {
      // For OAuth providers, auto-verify email
      if (account?.provider === "google" && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        })
        
        if (existingUser && !existingUser.emailVerified) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { emailVerified: new Date() },
          })
        }
      }
      return true
    },
  },
})
