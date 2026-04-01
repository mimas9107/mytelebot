import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "mytelebot",
    version: "0.9.9",
    status: "ok",
    timestamp: new Date().toISOString()
  });
}
