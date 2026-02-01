import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * GET /healthz
 * Health check endpoint for monitoring and load balancing
 * 
 * Returns 200 OK if all critical services are operational
 * Returns 503 Service Unavailable if any critical service is down
 */
export async function GET() {
  const checks: Record<string, boolean> = {
    database: false,
    redis: false,
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    console.error("[Health] Database check failed:", error);
  }

  try {
    // Check Redis connection
    const redis = await getRedis();
    await redis.ping();
    checks.redis = true;
  } catch (error) {
    console.error("[Health] Redis check failed:", error);
  }

  const allHealthy = Object.values(checks).every((check) => check === true);

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
      version: process.env.APP_VERSION || "dev",
    },
    { status: allHealthy ? 200 : 503 }
  );
}
