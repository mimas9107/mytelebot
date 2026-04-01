import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/session";
import { listRegistryData } from "@/lib/registry";
import {
  deleteCommandAction,
  deleteDeviceAction,
  deleteTargetAction,
  toggleCommandStatusAction,
  toggleDeviceStatusAction,
  toggleTargetStatusAction
} from "@/app/admin/registry/actions";
import {
  CommandDryRunForm,
  CommandEditForm,
  CommandCreateForm,
  DeviceCreateForm,
  DeviceEditForm,
  TargetEditForm,
  TargetTestForm,
  TargetCreateForm
} from "@/app/admin/registry/forms";

export default async function RegistryPage() {
  await requireAdminSession();
  const { targets, devices, commands } = await listRegistryData();

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Device registry</p>
          <h1>Targets, devices, and commands</h1>
          <p className="lead">
            Define the exact infrastructure that the Telegram bot is allowed to
            control before any LLM parsing happens.
          </p>
        </div>
      </section>

      <section className="registry-grid">
        <article className="card">
          <h2>Create target</h2>
          <TargetCreateForm />
        </article>

        <article className="card">
          <h2>Create device</h2>
          <DeviceCreateForm targets={targets} />
        </article>

        <article className="card">
          <h2>Create command</h2>
          <CommandCreateForm devices={devices} />
        </article>
      </section>

      <section className="card-grid registry-lists">
        <article className="card">
          <h2>Targets</h2>
          {targets.length === 0 ? (
            <p className="empty-state">No targets configured yet.</p>
          ) : (
            <div className="provider-list">
              {targets.map((target) => (
                <section key={target.id} className="provider-item">
                  <div className="provider-head">
                    <div>
                      <h3>{target.name}</h3>
                      <p>{target.targetKey}</p>
                    </div>
                    <div className="provider-badges">
                      <span className="status-pill">{target.status}</span>
                    </div>
                  </div>

                  <dl className="provider-meta">
                    <div>
                      <dt>Base URL</dt>
                      <dd>{target.baseUrl}</dd>
                    </div>
                    <div>
                      <dt>Auth type</dt>
                      <dd>{target.authType}</dd>
                    </div>
                    <div>
                      <dt>Auth secret</dt>
                      <dd>{target.hasAuthSecret ? "Stored securely" : "Not stored"}</dd>
                    </div>
                    <div>
                      <dt>Timeout</dt>
                      <dd>{target.timeoutMs} ms</dd>
                    </div>
                  </dl>

                  <div className="provider-actions">
                    <details className="inline-details">
                      <summary>Edit target</summary>
                      <div className="inline-details-body">
                        <TargetEditForm target={target} />
                      </div>
                    </details>

                    <TargetTestForm targetId={target.id} />

                    <form action={toggleTargetStatusAction}>
                      <input type="hidden" name="targetId" value={target.id} />
                      <button type="submit" className="button-secondary">
                        {target.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </form>

                    <form action={deleteTargetAction}>
                      <input type="hidden" name="targetId" value={target.id} />
                      <button type="submit" className="button-danger">
                        Delete
                      </button>
                    </form>
                  </div>
                </section>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <h2>Devices</h2>
          {devices.length === 0 ? (
            <p className="empty-state">No devices configured yet.</p>
          ) : (
            <div className="provider-list">
              {devices.map((device) => (
                <section key={device.id} className="provider-item">
                  <div className="provider-head">
                    <div>
                      <h3>{device.name}</h3>
                      <p>{device.deviceKey}</p>
                    </div>
                    <div className="provider-badges">
                      <span className="status-pill">{device.status}</span>
                    </div>
                  </div>

                  <dl className="provider-meta">
                    <div>
                      <dt>Target</dt>
                      <dd>
                        {device.target.name} ({device.target.targetKey})
                      </dd>
                    </div>
                    <div>
                      <dt>Type</dt>
                      <dd>{device.type}</dd>
                    </div>
                    <div>
                      <dt>Description</dt>
                      <dd>{device.description || "Not set"}</dd>
                    </div>
                    <div>
                      <dt>Aliases</dt>
                      <dd>
                        {device.aliases?.length > 0
                          ? device.aliases.join(", ")
                          : "Not set"}
                      </dd>
                    </div>
                  </dl>

                  <div className="provider-actions">
                    <details className="inline-details">
                      <summary>Edit device</summary>
                      <div className="inline-details-body">
                        <DeviceEditForm device={device} />
                      </div>
                    </details>

                    <form action={toggleDeviceStatusAction}>
                      <input type="hidden" name="deviceId" value={device.id} />
                      <button type="submit" className="button-secondary">
                        {device.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </form>

                    <form action={deleteDeviceAction}>
                      <input type="hidden" name="deviceId" value={device.id} />
                      <button type="submit" className="button-danger">
                        Delete
                      </button>
                    </form>
                  </div>
                </section>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="card">
        <h2>Commands</h2>
        {commands.length === 0 ? (
          <p className="empty-state">No commands configured yet.</p>
        ) : (
          <div className="provider-list">
            {commands.map((command) => (
              <section key={command.id} className="provider-item">
                <div className="provider-head">
                  <div>
                    <h3>{command.label}</h3>
                    <p>{command.commandKey}</p>
                  </div>
                  <div className="provider-badges">
                    <span className="status-pill">{command.status}</span>
                    {command.confirmationRequired ? (
                      <span className="status-pill status-pill-active">
                        confirm
                      </span>
                    ) : null}
                  </div>
                </div>

                <dl className="provider-meta">
                  <div>
                    <dt>Target / Device</dt>
                    <dd>
                      {command.device.target.name} / {command.device.name}
                    </dd>
                  </div>
                  <div>
                    <dt>Method</dt>
                    <dd>{command.method}</dd>
                  </div>
                  <div>
                    <dt>Aliases</dt>
                    <dd>
                      {command.aliases?.length > 0
                        ? command.aliases.join(", ")
                        : "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt>Path</dt>
                    <dd>{command.path}</dd>
                  </div>
                  <div>
                    <dt>Cooldown</dt>
                    <dd>{command.cooldownSeconds ? `${command.cooldownSeconds} sec` : "None"}</dd>
                  </div>
                  <div>
                    <dt>Payload template</dt>
                    <dd>{command.payloadTemplateJson || "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Args schema</dt>
                    <dd>{command.argsSchemaJson || "Not set"}</dd>
                  </div>
                </dl>

                <div className="provider-actions">
                  <details className="inline-details">
                    <summary>Edit command</summary>
                    <div className="inline-details-body">
                      <CommandEditForm command={command} />
                    </div>
                  </details>

                  <details className="inline-details">
                    <summary>Dry run</summary>
                    <div className="inline-details-body">
                      <CommandDryRunForm command={command} />
                    </div>
                  </details>

                  <form action={toggleCommandStatusAction}>
                    <input type="hidden" name="commandId" value={command.id} />
                    <button type="submit" className="button-secondary">
                      {command.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </form>

                  <form action={deleteCommandAction}>
                    <input type="hidden" name="commandId" value={command.id} />
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
      </section>
    </main>
  );
}
