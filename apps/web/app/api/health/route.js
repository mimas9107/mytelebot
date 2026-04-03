import { NextResponse } from "next/server";
import { logInfo } from "@/lib/logger";

export async function GET() {
  logInfo("health_route_ok", {
    route: "/api/health"
  });
  return NextResponse.json({
    ok: true,
    service: "mytelebot",
    version: "1.0.3",
    status: "ok",
    timestamp: new Date().toISOString()
  });
}
