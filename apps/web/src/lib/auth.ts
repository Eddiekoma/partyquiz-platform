import NextAuth, { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import { PrismaAdapter } from "@auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import { prisma } from "./prisma";
import { getEnv } from "./env";

const env = getEnv();

// Email provider configuration - only if SMTP credentials are available
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
    })
  : null;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: emailProvider ? [emailProvider] : [],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
  },
  session: {
    strategy: "database",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  secret: env.NEXTAUTH_SECRET || "temp-build-secret-change-in-production",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

// Helper function to get session in server components
export async function auth() {
  return getServerSession(authOptions);
}

