import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { prisma } from "./prisma";
import { getEnv } from "./env";
import { verifyPassword } from "./password";

const env = getEnv();

// Build providers array dynamically
const providers: any[] = [
  Credentials({
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
        where: { email: (credentials.email as string).toLowerCase() },
      });

      if (!user) {
        throw new Error("Geen account gevonden met dit emailadres");
      }

      const userWithPassword = user as any;
      if (!userWithPassword.passwordHash) {
        throw new Error("Dit account gebruikt een andere inlogmethode (bijv. Google)");
      }

      if (!user.emailVerified) {
        throw new Error("Verifieer eerst je email voordat je kunt inloggen");
      }

      const isValid = await verifyPassword(credentials.password as string, userWithPassword.passwordHash);
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
  }),
];

// Add Google OAuth if configured
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

// Add Nodemailer if configured
if (env.EMAIL_SMTP_HOST && env.EMAIL_SMTP_USER && env.EMAIL_SMTP_PASS && env.EMAIL_FROM) {
  providers.push(
    Nodemailer({
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
  );
}

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  providers,
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
    newUser: "/dashboard", // Redirect new users to dashboard
  },
  session: {
    strategy: "jwt" as const, // Use JWT strategy - required for CredentialsProvider
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    jwt({ token, user }: any) {
      // Initial sign in - add user id to token
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }: any) {
      // Add user id from token to session
      if (session.user && token.id) {
        (session.user as any).id = token.id as string;
      }
      return session;
    },
    async signIn({ user, account }: any) {
      // For OAuth providers, auto-verify email
      if (account?.provider === "google" && user?.email) {
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

// NextAuth v5 export
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

// Export handlers for API route
export const { GET, POST } = handlers;