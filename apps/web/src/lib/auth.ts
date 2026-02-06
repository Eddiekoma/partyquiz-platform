import NextAuth, { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { prisma } from "./prisma";
import { getEnv } from "./env";
import { verifyPassword } from "./password";
import { sendMagicLinkEmail } from "./email";

const env = getEnv();

// Credentials provider for email + password login
const credentialsProvider = CredentialsProvider({
  id: "credentials",
  name: "Email & Wachtwoord",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Wachtwoord", type: "password" },
  },
  async authorize(credentials) {
    if (!credentials?.email || !credentials?.password) {
      throw new Error("Email en wachtwoord zijn verplicht");
    }

    const user = await prisma.user.findUnique({
      where: { email: credentials.email.toLowerCase() },
    });

    if (!user) {
      throw new Error("Geen account gevonden met dit emailadres");
    }

    // Cast to any for local dev - Prisma types are regenerated in Docker with new fields
    const userWithPassword = user as any;
    if (!userWithPassword.passwordHash) {
      throw new Error("Dit account gebruikt een andere inlogmethode (bijv. Google)");
    }

    if (!user.emailVerified) {
      throw new Error("Verifieer eerst je email voordat je kunt inloggen");
    }

    const isValid = await verifyPassword(credentials.password, userWithPassword.passwordHash);
    if (!isValid) {
      throw new Error("Ongeldig wachtwoord");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  },
});

// Email provider for magic link (kept as fallback)
const emailProvider = env.EMAIL_SMTP_HOST && env.EMAIL_SMTP_USER && env.EMAIL_SMTP_PASS && env.EMAIL_FROM
  ? EmailProvider({
      server: {
        host: env.EMAIL_SMTP_HOST,
        port: parseInt(env.EMAIL_SMTP_PORT || "587"),
        auth: {
          user: env.EMAIL_SMTP_USER,
          pass: env.EMAIL_SMTP_PASS,
        },
      },
      from: env.EMAIL_FROM,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    })
  : null;

// Google OAuth provider
const googleProvider = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
  ? GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true, // Allow linking with existing accounts
    })
  : null;

// Build providers array
const providers = [
  credentialsProvider,
  ...(emailProvider ? [emailProvider] : []),
  ...(googleProvider ? [googleProvider] : []),
];

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
    newUser: "/dashboard", // Redirect new users to dashboard
  },
  session: {
    strategy: "jwt", // Use JWT strategy - required for CredentialsProvider
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in - add user id to token
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user id from token to session
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async signIn({ user, account }) {
      // For OAuth providers, auto-verify email
      if (account?.provider === "google" && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
        
        if (existingUser && !existingUser.emailVerified) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { emailVerified: new Date() },
          });
        }
      }
      return true;
    },
  },
  secret: env.NEXTAUTH_SECRET || "temp-build-secret-change-in-production",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

// Helper function to get session in server components
export async function auth() {
  const session = await getServerSession(authOptions);
  console.log("[AUTH] getServerSession result:", session ? `User: ${session.user?.email}` : "null");
  return session;
}

