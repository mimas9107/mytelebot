import { NextResponse } from "next/server";
import { listOperationalOverview } from "@/lib/system";

export async function GET() {
  try {
    const overview = await listOperationalOverview();

    return NextResponse.json({
      ok: true,
      component: "metrics",
      ...overview
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        component: "metrics",
        error: error instanceof Error ? error.message : "metrics collection failed",
        generatedAt: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
