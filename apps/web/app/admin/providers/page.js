import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/session";
import { listProviders } from "@/lib/providers";
import {
  deleteProviderAction,
  setDefaultProviderAction,
  toggleProviderStatusAction
} from "@/app/admin/providers/actions";
import {
  ProviderCreateForm,
  ProviderEditForm,
  ProviderRotateApiKeyForm,
  ProviderTestForm
} from "@/app/admin/providers/form";

export const dynamic = "force-dynamic";

function formatTimestamp(value) {
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

export default async function ProvidersPage() {
  await requireAdminSession();
  const providers = await listProviders();

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">LLM providers</p>
          <h1>Provider registry</h1>
          <p className="lead">
            Manage OpenAI-compatible endpoints, active model routing, and
            encrypted API keys.
          </p>
        </div>
      </section>

      <section className="card-grid provider-layout">
        <article className="card">
          <h2>Create provider</h2>
          <ProviderCreateForm />
        </article>

        <article className="card">
          <h2>Configured providers</h2>
          {providers.length === 0 ? (
            <p className="empty-state">No providers configured yet.</p>
          ) : (
            <div className="provider-list">
              {providers.map((provider) => (
                <section key={provider.id} className="provider-item">
                  <div className="provider-head">
                    <div>
                      <h3>{provider.name}</h3>
                      <p>{provider.providerKey}</p>
                    </div>
                    <div className="provider-badges">
                      <span className="status-pill">{provider.status}</span>
                      {provider.isDefault ? (
                        <span className="status-pill status-pill-active">
                          default
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <dl className="provider-meta">
                    <div>
                      <dt>Base URL</dt>
                      <dd>{provider.baseUrl}</dd>
                    </div>
                    <div>
                      <dt>Model</dt>
                      <dd>{provider.model}</dd>
                    </div>
                    <div>
                      <dt>API key</dt>
                      <dd>{provider.maskedApiKey || "Not stored"}</dd>
                    </div>
                    <div>
                      <dt>API key versions</dt>
                      <dd>{provider.apiKeyVersionCount}</dd>
                    </div>
                    <div>
                      <dt>Capability profile</dt>
                      <dd>{provider.capabilityProfile}</dd>
                    </div>
                    <div>
                      <dt>JSON output mode</dt>
                      <dd>{provider.jsonOutputMode}</dd>
                    </div>
                    <div>
                      <dt>JSON strictness</dt>
                      <dd>{provider.jsonStrict ? "strict" : "relaxed"}</dd>
                    </div>
                  </dl>

                  <div className="provider-actions">
                    <details className="inline-details">
                      <summary>Edit provider</summary>
                      <div className="inline-details-body">
                        <ProviderEditForm provider={provider} />
                      </div>
                    </details>

                    <ProviderTestForm providerId={provider.id} />

                    <details className="inline-details">
                      <summary>Rotate API key</summary>
                      <div className="inline-details-body">
                        <ProviderRotateApiKeyForm providerId={provider.id} />
                      </div>
                    </details>

                    <details className="inline-details">
                      <summary>API key history</summary>
                      <div className="inline-details-body">
                        {provider.apiKeyHistory.length === 0 ? (
                          <p className="empty-state">No API key history stored.</p>
                        ) : (
                          <div className="provider-list">
                            {provider.apiKeyHistory.map((secret) => (
                              <section key={secret.id} className="provider-item">
                                <dl className="provider-meta">
                                  <div>
                                    <dt>Secret ID</dt>
                                    <dd>{secret.id}</dd>
                                  </div>
                                  <div>
                                    <dt>Created</dt>
                                    <dd>{formatTimestamp(secret.createdAt)}</dd>
                                  </div>
                                  <div>
                                    <dt>Rotated</dt>
                                    <dd>{secret.rotatedAt ? formatTimestamp(secret.rotatedAt) : "current"}</dd>
                                  </div>
                                </dl>
                              </section>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>

                    <form action={toggleProviderStatusAction}>
                      <input type="hidden" name="providerId" value={provider.id} />
                      <button type="submit" className="button-secondary">
                        {provider.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </form>

                    <form action={setDefaultProviderAction}>
                      <input type="hidden" name="providerId" value={provider.id} />
                      <button
                        type="submit"
                        className="button-secondary"
                        disabled={provider.isDefault}
                      >
                        Set default
                      </button>
                    </form>

                    <form action={deleteProviderAction}>
                      <input type="hidden" name="providerId" value={provider.id} />
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
