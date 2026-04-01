import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/session";
import { listAuditLogs } from "@/lib/audit";

export const dynamic = "force-dynamic";

function firstValue(value) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return typeof value === "string" ? value : "";
}

function prettyDate(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function previewJson(value) {
  if (!value) {
    return "No parsed result recorded.";
  }

  return JSON.stringify(value, null, 2);
}

function extractParsedEnvelope(parsedResult) {
  if (!parsedResult) {
    return {
      parsed: null,
      dispatchResult: null
    };
  }

  if ("parsed" in parsedResult || "dispatchResult" in parsedResult) {
    return {
      parsed: parsedResult.parsed || null,
      dispatchResult: parsedResult.dispatchResult || null
    };
  }

  return {
    parsed: parsedResult,
    dispatchResult: null
  };
}

function summarizeParsedAction(parsed) {
  const action = Array.isArray(parsed?.actions) ? parsed.actions[0] : null;

  if (!action) {
    return "No action parsed.";
  }

  return [
    `target=${action.target_key || "-"}`,
    `device=${action.device_key || "-"}`,
    `command=${action.command_key || "-"}`,
    `args=${JSON.stringify(action.args || {})}`
  ].join(" | ");
}

export default async function AuditPage({ searchParams }) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;

  const filters = {
    status: firstValue(resolvedSearchParams?.status),
    actorType: firstValue(resolvedSearchParams?.actorType),
    providerId: firstValue(resolvedSearchParams?.providerId),
    query: firstValue(resolvedSearchParams?.query)
  };
  const { logs, providers, totalCount, filteredCount } = await listAuditLogs(filters);

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Audit logs</p>
          <h1>Execution history</h1>
          <p className="lead">
            Inspect Telegram inputs, parsed outputs, validation failures, and
            target dispatch results from one place.
          </p>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Total logs</span>
          <strong>{totalCount}</strong>
        </article>
        <article className="metric-card">
          <span>Filtered logs</span>
          <strong>{filteredCount}</strong>
        </article>
        <article className="metric-card">
          <span>Providers</span>
          <strong>{providers.length}</strong>
        </article>
        <article className="metric-card">
          <span>Shown</span>
          <strong>{logs.length}</strong>
        </article>
      </section>

      <section className="card audit-filter-card">
        <h2>Filters</h2>
        <form method="GET" className="provider-form">
          <div className="form-grid">
            <label>
              <span>Status</span>
              <input
                name="status"
                type="text"
                defaultValue={filters.status}
                placeholder="dispatch_success"
              />
            </label>

            <label>
              <span>Actor type</span>
              <input
                name="actorType"
                type="text"
                defaultValue={filters.actorType}
                placeholder="telegram"
              />
            </label>

            <label>
              <span>Provider</span>
              <select name="providerId" defaultValue={filters.providerId}>
                <option value="">All providers</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.providerKey})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Query</span>
              <input
                name="query"
                type="text"
                defaultValue={filters.query}
                placeholder="light_01 or unauthorized"
              />
            </label>
          </div>

          <div className="audit-filter-actions">
            <button type="submit" className="button-primary">
              Apply filters
            </button>
            <Link href="/admin/audit" className="button-secondary audit-link-button">
              Clear filters
            </Link>
          </div>
        </form>
      </section>

      <p className="card-link">
        <Link href="/admin">Back to dashboard</Link>
      </p>

      <section className="card">
        <h2>Recent entries</h2>
        {logs.length === 0 ? (
          <p className="empty-state">No audit logs matched the current filters.</p>
        ) : (
          <div className="audit-log-list">
            {logs.map((log) => (
              (() => {
                const { parsed, dispatchResult } = extractParsedEnvelope(log.parsedResult);

                return (
                  <article key={log.id} className="audit-log-item">
                    <div className="provider-head">
                      <div>
                        <h3>{log.executionStatus}</h3>
                        <p>{prettyDate(log.createdAt)}</p>
                      </div>
                      <div className="provider-badges">
                        <span className="status-pill">{log.actorType}</span>
                        {log.provider ? (
                          <span className="status-pill status-pill-active">
                            {log.provider.providerKey}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <dl className="provider-meta audit-meta">
                      <div>
                        <dt>Actor ID</dt>
                        <dd>{log.actorId || "Not set"}</dd>
                      </div>
                      <div>
                        <dt>User</dt>
                        <dd>{log.user?.username || "Not linked"}</dd>
                      </div>
                      <div>
                        <dt>Provider</dt>
                        <dd>
                          {log.provider
                            ? `${log.provider.name} (${log.provider.model})`
                            : "Not recorded"}
                        </dd>
                      </div>
                      <div>
                        <dt>Error</dt>
                        <dd>{log.errorMessage || "None"}</dd>
                      </div>
                    </dl>

                    <div className="audit-detail-grid">
                      <div className="audit-block">
                        <strong>Raw input</strong>
                        <pre>{log.rawInput}</pre>
                      </div>

                      <div className="audit-block">
                        <strong>Parse summary</strong>
                        <pre>{summarizeParsedAction(parsed)}</pre>
                      </div>

                      <div className="audit-block">
                        <strong>Parsed payload</strong>
                        <pre>{previewJson(parsed)}</pre>
                      </div>

                      <div className="audit-block">
                        <strong>Dispatch request</strong>
                        <pre>{previewJson(dispatchResult?.request || null)}</pre>
                      </div>

                      <div className="audit-block">
                        <strong>Dispatch response</strong>
                        <pre>
                          {previewJson(
                            dispatchResult
                              ? {
                                  ok: dispatchResult.ok,
                                  status: dispatchResult.status,
                                  errorType: dispatchResult.errorType,
                                  errorMessage: dispatchResult.errorMessage,
                                  responseText: dispatchResult.responseText
                                }
                              : null
                          )}
                        </pre>
                      </div>
                    </div>
                  </article>
                );
              })()
            ))}
          </div>
        )}

        <p className="card-link">
          <Link href="/admin">Back to dashboard</Link>
        </p>
      </section>
    </main>
  );
}
