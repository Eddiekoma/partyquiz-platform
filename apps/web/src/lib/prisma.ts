import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    // Prisma 7: Explicitly use binary engine for traditional Node.js runtime
    __internal: {
      engine: {
        binaryTargets: ["native"],
      },
    },
  } as any);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
