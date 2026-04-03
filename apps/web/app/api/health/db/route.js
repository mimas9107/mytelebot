import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, logInfo } from "@/lib/logger";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    logInfo("health_db_ok", {
      route: "/api/health/db"
    });

    return NextResponse.json({
      ok: true,
      status: "healthy",
      component: "db",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logError("health_db_failed", {
      route: "/api/health/db",
      error
    });
    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
        component: "db",
        error: error instanceof Error ? error.message : "database health check failed",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
