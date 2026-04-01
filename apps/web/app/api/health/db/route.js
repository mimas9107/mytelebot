import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      status: "healthy",
      component: "db",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
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
