import { NextResponse } from "next/server";
import { listRegistryData, testTargetConnection } from "@/lib/registry";

export async function GET() {
  const { targets } = await listRegistryData();
  const checks = await Promise.all(
    targets.map(async (target) => {
      try {
        const result = await testTargetConnection(target.id);
        return {
          targetId: target.id,
          targetKey: target.targetKey,
          name: target.name,
          status: target.status,
          reachable: result.reachable,
          ok: result.ok,
          httpStatus: result.status,
          endpoint: result.endpoint,
          message: result.message
        };
      } catch (error) {
        return {
          targetId: target.id,
          targetKey: target.targetKey,
          name: target.name,
          status: target.status,
          reachable: false,
          ok: false,
          httpStatus: null,
          endpoint: target.baseUrl,
          message: error instanceof Error ? error.message : "target health check failed"
        };
      }
    })
  );

  const healthyCount = checks.filter((item) => item.ok).length;

  return NextResponse.json({
    ok: true,
    component: "targets",
    summary: {
      total: checks.length,
      healthy: healthyCount,
      unhealthy: checks.length - healthyCount
    },
    targets: checks,
    timestamp: new Date().toISOString()
  });
}
