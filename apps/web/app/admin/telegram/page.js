import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/session";
import { listAdminUsers, listTelegramAccounts } from "@/lib/telegram";
import {
  deleteTelegramAccountAction,
  toggleTelegramAccountStatusAction
} from "@/app/admin/telegram/actions";
import {
  TelegramAccountEditForm,
  TelegramAccountForm
} from "@/app/admin/telegram/form";

export default async function TelegramAdminPage() {
  await requireAdminSession();
  const [accounts, users] = await Promise.all([
    listTelegramAccounts(),
    listAdminUsers()
  ]);

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Telegram access</p>
          <h1>Bot allowlist</h1>
          <p className="lead">
            Only Telegram users in this list can reach the webhook MVP flow.
          </p>
        </div>
      </section>

      <section className="card-grid provider-layout">
        <article className="card">
          <h2>Add allowlist account</h2>
          <TelegramAccountForm users={users} />
        </article>

        <article className="card">
          <h2>Allowed Telegram accounts</h2>
          {accounts.length === 0 ? (
            <p className="empty-state">No Telegram accounts configured yet.</p>
          ) : (
            <div className="provider-list">
              {accounts.map((account) => (
                <section key={account.id} className="provider-item">
                  <div className="provider-head">
                    <div>
                      <h3>{account.displayName || account.username || "Telegram user"}</h3>
                      <p>{account.telegramUserId}</p>
                    </div>
                    <div className="provider-badges">
                      <span className="status-pill">{account.status}</span>
                    </div>
                  </div>

                  <dl className="provider-meta">
                    <div>
                      <dt>Username</dt>
                      <dd>{account.username || "Not set"}</dd>
                    </div>
                    <div>
                      <dt>Linked admin user</dt>
                      <dd>{account.user?.username || "Not linked"}</dd>
                    </div>
                  </dl>

                  <div className="provider-actions">
                    <details className="inline-details">
                      <summary>Edit account</summary>
                      <div className="inline-details-body">
                        <TelegramAccountEditForm account={account} users={users} />
                      </div>
                    </details>

                    <form action={toggleTelegramAccountStatusAction}>
                      <input type="hidden" name="accountId" value={account.id} />
                      <button type="submit" className="button-secondary">
                        {account.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </form>

                    <form action={deleteTelegramAccountAction}>
                      <input type="hidden" name="accountId" value={account.id} />
                      <button type="submit" className="button-danger">
                        Delete
                      </button>
                    </form>
                  </div>
                </section>
              ))}
            </div>
          )}

          <p className="card-link">
            <Link href="/admin">Back to dashboard</Link>
          </p>
        </article>
      </section>
    </main>
  );
}
