import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/session";
import {
  getRuntimeLoggingSettings,
  listOperationalOverview,
  listSystemBackups
} from "@/lib/system";
import {
  BackupUploadForm,
  BackupCreateForm,
  BackupRestoreForm,
  RuntimeLoggingForm
} from "@/app/admin/system/form";

export const dynamic = "force-dynamic";

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

function formatBytes(value) {
  if (!Number.isFinite(value)) {
    return "unknown";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export default async function SystemPage() {
  await requireAdminSession();
  const [
    { sqliteFilePath, backupDirPath, database, backups },
    operationalOverview,
    runtimeSettings
  ] = await Promise.all([
    listSystemBackups(),
    listOperationalOverview(),
    getRuntimeLoggingSettings()
  ]);

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">System</p>
          <h1>Backup operations</h1>
          <p className="lead">
            Manage SQLite snapshots for the current single-instance prototype.
          </p>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Database size</span>
          <strong>{formatBytes(database.size)}</strong>
        </article>
        <article className="metric-card">
          <span>Backups</span>
          <strong>{backups.length}</strong>
        </article>
        <article className="metric-card metric-card-compact">
          <span>Database updated</span>
          <strong>{prettyDate(database.modifiedAt)}</strong>
        </article>
        <article className="metric-card metric-card-compact">
          <span>Latest backup</span>
          <strong>
            {backups[0] ? prettyDate(backups[0].modifiedAt) : "none"}
          </strong>
        </article>
      </section>

      <p className="card-link">
        <Link href="/admin">Back to dashboard</Link>
      </p>

      <section className="card">
        <h2>Operational metrics</h2>
        <div className="metric-grid">
          <article className="metric-card">
            <span>Dispatch success (24h)</span>
            <strong>{operationalOverview.metrics.dispatchSuccess24h}</strong>
          </article>
          <article className="metric-card">
            <span>Dispatch failures (24h)</span>
            <strong>{operationalOverview.metrics.dispatchFailures24h}</strong>
          </article>
          <article className="metric-card">
            <span>Pending confirmations</span>
            <strong>{operationalOverview.metrics.pendingConfirmations}</strong>
          </article>
          <article className="metric-card">
            <span>Provider errors (24h)</span>
            <strong>{operationalOverview.metrics.providerErrors24h}</strong>
          </article>
        </div>

        <div className="metric-grid">
          <article className="metric-card">
            <span>Telegram inputs (24h)</span>
            <strong>{operationalOverview.metrics.telegramReceived24h}</strong>
          </article>
          <article className="metric-card">
            <span>Active providers</span>
            <strong>{operationalOverview.metrics.activeProviders}</strong>
          </article>
          <article className="metric-card">
            <span>Active targets</span>
            <strong>{operationalOverview.metrics.activeTargets}</strong>
          </article>
          <article className="metric-card metric-card-compact">
            <span>Metrics generated</span>
            <strong>{prettyDate(operationalOverview.generatedAt)}</strong>
          </article>
        </div>

        <p className="card-link">
          <Link href="/api/metrics">Open JSON metrics endpoint</Link>
        </p>
      </section>

      <section className="card-grid provider-layout">
        <article className="card">
          <h2>Runtime logging</h2>
          <RuntimeLoggingForm verboseServerLogs={runtimeSettings.verboseServerLogs} />
        </article>

        <article className="card">
          <h2>Create backup</h2>
          <BackupCreateForm />
        </article>

        <article className="card">
          <h2>Upload backup</h2>
          <BackupUploadForm />
        </article>

        <article className="card">
          <h2>Restore safeguards</h2>
          <ul className="provider-meta provider-meta-list">
            <li>Only `.sqlite` files inside the configured backup directory are allowed.</li>
            <li>The selected backup is validated with `PRAGMA integrity_check` before restore.</li>
            <li>A pre-restore rollback backup is created automatically.</li>
            <li>Uploaded backups can be imported first, or uploaded and restored immediately.</li>
          </ul>
        </article>

        <article className="card">
          <h2>Paths</h2>
          <dl className="provider-meta">
            <div>
              <dt>SQLite file</dt>
              <dd>{sqliteFilePath}</dd>
            </div>
            <div>
              <dt>Backup directory</dt>
              <dd>{backupDirPath}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="card">
        <h2>Available backups</h2>
        {backups.length === 0 ? (
          <p className="empty-state">No SQLite backups have been created yet.</p>
        ) : (
          <div className="provider-list">
            {backups.map((backup) => (
              <section key={backup.name} className="provider-item">
                <div className="provider-head">
                  <div>
                    <h3>{backup.name}</h3>
                    <p>{prettyDate(backup.modifiedAt)}</p>
                  </div>
                  <div className="provider-actions">
                    <a
                      href={`/api/admin/system/backups/${encodeURIComponent(backup.name)}/download`}
                    >
                      Download
                    </a>
                  </div>
                </div>

                  <dl className="provider-meta">
                    <div>
                      <dt>Size</dt>
                    <dd>{formatBytes(backup.size)}</dd>
                  </div>
                    <div>
                      <dt>Path</dt>
                      <dd>{backup.path}</dd>
                    </div>
                  </dl>

                  <details className="inline-details">
                    <summary>Restore backup</summary>
                    <div className="inline-details-body">
                      <BackupRestoreForm filename={backup.name} />
                    </div>
                  </details>
                </section>
              ))}
            </div>
        )}
      </section>

      <section className="card">
        <h2>Operational events</h2>
        {operationalOverview.events.length === 0 ? (
          <p className="empty-state">No operational events recorded yet.</p>
        ) : (
          <div className="provider-list">
            {operationalOverview.events.map((event) => (
              <section key={event.id} className="provider-item">
                <div className="provider-head">
                  <div>
                    <h3>{event.executionStatus}</h3>
                    <p>{prettyDate(event.createdAt)}</p>
                  </div>
                  <div className="provider-badges">
                    <span className="status-pill">{event.actorType}</span>
                    {event.provider ? (
                      <span className="status-pill status-pill-active">
                        {event.provider.providerKey}
                      </span>
                    ) : null}
                  </div>
                </div>

                <dl className="provider-meta">
                  <div>
                    <dt>Actor</dt>
                    <dd>{event.user?.username || event.actorId || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Error</dt>
                    <dd>{event.errorMessage || "None"}</dd>
                  </div>
                  <div>
                    <dt>Raw input</dt>
                    <dd>{event.rawInput}</dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
