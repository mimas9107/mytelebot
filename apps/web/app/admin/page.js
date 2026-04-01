import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { logoutAction } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdminSession();
  const [providerCount, targetCount, deviceCount, auditCount] =
    await Promise.all([
      prisma.llmProvider.count(),
      prisma.target.count(),
      prisma.device.count(),
      prisma.auditLog.count()
    ]);

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Control panel</p>
          <h1>Admin dashboard</h1>
          <p className="lead">
            Logged in as <strong>{user.username}</strong>. This is the first
            protected admin surface for the prototype.
          </p>
        </div>

        <form action={logoutAction}>
          <button type="submit" className="button-secondary">
            Sign out
          </button>
        </form>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Providers</span>
          <strong>{providerCount}</strong>
        </article>
        <article className="metric-card">
          <span>Targets</span>
          <strong>{targetCount}</strong>
        </article>
        <article className="metric-card">
          <span>Devices</span>
          <strong>{deviceCount}</strong>
        </article>
        <article className="metric-card">
          <span>Audit logs</span>
          <strong>{auditCount}</strong>
        </article>
      </section>

      <section className="card-grid">
        <article className="card">
          <h2>What is working now</h2>
          <ul>
            <li>Bootstrap admin creation from `.env`</li>
            <li>Server-side session cookie</li>
            <li>Protected `/admin` route</li>
            <li>Prisma connected to SQLite</li>
            <li>Provider registry management</li>
            <li>Target, device, and command registry</li>
            <li>Telegram allowlist and webhook MVP</li>
          </ul>
          <p className="card-link">
            <Link href="/admin/providers">Open provider registry</Link>
          </p>
          <p className="card-link">
            <Link href="/admin/registry">Open device registry</Link>
          </p>
          <p className="card-link">
            <Link href="/admin/telegram">Open Telegram allowlist</Link>
          </p>
          <p className="card-link">
            <Link href="/admin/audit">Open audit logs</Link>
          </p>
          <p className="card-link">
            <Link href="/admin/system">Open system operations</Link>
          </p>
        </article>

        <article className="card">
          <h2>Next implementation targets</h2>
          <ol>
            <li>Provider connection test and edit flow</li>
            <li>Audit log filters and deeper detail drill-down</li>
            <li>SQLite restore operations</li>
            <li>Command confirmation and cooldown flow</li>
            <li>Health checks for providers and targets</li>
          </ol>
          <p className="card-link">
            <Link href="/">Back to overview</Link>
          </p>
        </article>
      </section>
    </main>
  );
}
