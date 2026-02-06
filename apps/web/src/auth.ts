import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import Nodemailer from "next-auth/providers/nodemailer"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password"
import authConfig from "./auth.config"

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
    name: "Email & Wachtwoord",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Wachtwoord", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error("Email en wachtwoord zijn verplicht")
      }

      const email = (credentials.email as string).toLowerCase()
      const password = credentials.password as string

      const user = await prisma.user.findUnique({
        where: { email },
      })

      if (!user) {
        throw new Error("Geen account gevonden met dit emailadres")
      }

      const userWithPassword = user as any
      if (!userWithPassword.passwordHash) {
        throw new Error("Dit account gebruikt een andere inlogmethode (bijv. Google)")
      }

      if (!user.emailVerified) {
        throw new Error("Verifieer eerst je email voordat je kunt inloggen")
      }

      const isValid = await verifyPassword(password, userWithPassword.passwordHash)
      if (!isValid) {
        throw new Error("Ongeldig wachtwoord")
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
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
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
