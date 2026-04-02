import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "mytelebot",
    version: "1.0.3",
    status: "ok",
    timestamp: new Date().toISOString()
  });
}
