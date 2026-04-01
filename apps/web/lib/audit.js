import { prisma } from "@/lib/prisma";

function parseParsedResultJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function listAuditLogs(filters = {}) {
  const {
    status = "",
    actorType = "",
    providerId = "",
    query = "",
    limit = 50
  } = filters;

  const where = {
    ...(status ? { executionStatus: status } : {}),
    ...(actorType ? { actorType } : {}),
    ...(providerId ? { providerId } : {}),
    ...(query
      ? {
          OR: [
            {
              rawInput: {
                contains: query
              }
            },
            {
              errorMessage: {
                contains: query
              }
            },
            {
              actorId: {
                contains: query
              }
            }
          ]
        }
      : {})
  };

  const [logs, totalCount, filteredCount, providers] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      },
      take: limit,
      include: {
        provider: {
          select: {
            id: true,
            providerKey: true,
            name: true,
            model: true
          }
        },
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    }),
    prisma.auditLog.count(),
    prisma.auditLog.count({ where }),
    prisma.llmProvider.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        providerKey: true,
        name: true
      }
    })
  ]);

  return {
    totalCount,
    filteredCount,
    providers,
    logs: logs.map((log) => ({
      ...log,
      parsedResult: parseParsedResultJson(log.parsedResultJson)
    }))
  };
}
