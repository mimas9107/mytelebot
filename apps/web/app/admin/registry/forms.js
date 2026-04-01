"use client";

import { useActionState } from "react";
import {
  createCommandAction,
  createDeviceAction,
  createTargetAction,
  dryRunCommandAction,
  testTargetConnectionAction,
  updateCommandAction,
  updateDeviceAction,
  updateTargetAction
} from "@/app/admin/registry/actions";

const initialState = {
  ok: false,
  error: ""
};

export function TargetCreateForm() {
  const [state, formAction, isPending] = useActionState(
    createTargetAction,
    initialState
  );

  return (
    <form action={formAction} className="provider-form">
      <div className="form-grid">
        <label>
          <span>Target key</span>
          <input name="targetKey" type="text" placeholder="home-gateway-main" required />
        </label>

        <label>
          <span>Name</span>
          <input name="name" type="text" placeholder="Home Gateway" required />
        </label>

        <label>
          <span>Base URL</span>
          <input
            name="baseUrl"
            type="url"
            placeholder="https://gateway.example.com/api"
            required
          />
        </label>

        <label>
          <span>Auth type</span>
          <select name="authType" defaultValue="bearer">
            <option value="none">none</option>
            <option value="bearer">bearer</option>
            <option value="header">header</option>
            <option value="query">query</option>
            <option value="hmac">hmac</option>
          </select>
        </label>

        <label>
          <span>Timeout (ms)</span>
          <input name="timeoutMs" type="number" min="100" defaultValue="8000" />
        </label>
      </div>

      <label>
        <span>Auth secret</span>
        <input name="authSecret" type="password" placeholder="Optional target secret" />
      </label>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.ok ? <p className="form-success">Target saved.</p> : null}

      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Saving..." : "Create target"}
      </button>
    </form>
  );
}

export function DeviceCreateForm({ targets }) {
  const [state, formAction, isPending] = useActionState(
    createDeviceAction,
    initialState
  );

  return (
    <form action={formAction} className="provider-form">
      <div className="form-grid">
        <label>
          <span>Device key</span>
          <input name="deviceKey" type="text" placeholder="living-room-ac" required />
        </label>

        <label>
          <span>Name</span>
          <input name="name" type="text" placeholder="客廳冷氣" required />
        </label>

        <label>
          <span>Target</span>
          <select name="targetId" defaultValue="" required>
            <option value="" disabled>
              Select target
            </option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name} ({target.targetKey})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Type</span>
          <input name="type" type="text" placeholder="air_conditioner" required />
        </label>
      </div>

      <label>
        <span>Description</span>
        <textarea
          name="description"
          rows="3"
          placeholder="Optional description for prompt context"
        />
      </label>

      <label>
        <span>Aliases JSON</span>
        <textarea
          name="aliasesJson"
          rows="3"
          placeholder={'["燈","電燈","light"]'}
        />
      </label>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.ok ? <p className="form-success">Device saved.</p> : null}

      <button
        type="submit"
        className="button-primary"
        disabled={isPending || targets.length === 0}
      >
        {isPending ? "Saving..." : "Create device"}
      </button>
    </form>
  );
}

export function TargetEditForm({ target }) {
  const [state, formAction, isPending] = useActionState(
    updateTargetAction,
    initialState
  );

  return (
    <form action={formAction} className="provider-form">
      <input type="hidden" name="targetId" value={target.id} />

      <div className="form-grid">
        <label>
          <span>Target key</span>
          <input name="targetKeyReadonly" type="text" value={target.targetKey} readOnly />
        </label>

        <label>
          <span>Name</span>
          <input name="name" type="text" defaultValue={target.name} required />
        </label>

        <label>
          <span>Base URL</span>
          <input name="baseUrl" type="url" defaultValue={target.baseUrl} required />
        </label>

        <label>
          <span>Auth type</span>
          <select name="authType" defaultValue={target.authType}>
            <option value="none">none</option>
            <option value="bearer">bearer</option>
            <option value="header">header</option>
            <option value="query">query</option>
            <option value="hmac">hmac</option>
          </select>
        </label>

        <label>
          <span>Timeout (ms)</span>
          <input
            name="timeoutMs"
            type="number"
            min="100"
            defaultValue={target.timeoutMs}
          />
        </label>
      </div>

      <label>
        <span>New auth secret</span>
        <input
          name="authSecret"
          type="password"
          placeholder="Leave blank to keep current secret"
        />
      </label>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.ok ? <p className="form-success">Target updated.</p> : null}

      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Saving..." : "Update target"}
      </button>
    </form>
  );
}

export function CommandCreateForm({ devices }) {
  const [state, formAction, isPending] = useActionState(
    createCommandAction,
    initialState
  );

  return (
    <form action={formAction} className="provider-form">
      <div className="form-grid">
        <label>
          <span>Command key</span>
          <input name="commandKey" type="text" placeholder="set_temperature" required />
        </label>

        <label>
          <span>Label</span>
          <input name="label" type="text" placeholder="設定溫度" required />
        </label>

        <label>
          <span>Device</span>
          <select name="deviceId" defaultValue="" required>
            <option value="" disabled>
              Select device
            </option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} ({device.deviceKey})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Method</span>
          <select name="method" defaultValue="POST">
            <option value="POST">POST</option>
            <option value="GET">GET</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
        </label>

        <label>
          <span>Path</span>
          <input name="path" type="text" placeholder="/ac/living-room/temperature" required />
        </label>

        <label>
          <span>Cooldown (sec)</span>
          <input name="cooldownSeconds" type="number" min="0" defaultValue="0" />
        </label>
      </div>

      <label>
        <span>Aliases JSON</span>
        <textarea
          name="aliasesJson"
          rows="3"
          placeholder={'["打開","開燈","turn_on"]'}
        />
      </label>

      <label>
        <span>Payload template JSON</span>
        <textarea
          name="payloadTemplateJson"
          rows="4"
          placeholder={'{"temperature":"{{temperature}}"}'}
        />
      </label>

      <label>
        <span>Args schema JSON</span>
        <textarea
          name="argsSchemaJson"
          rows="5"
          placeholder={
            '{"type":"object","properties":{"temperature":{"type":"number","minimum":18,"maximum":30}}}'
          }
        />
      </label>

      <label className="checkbox-row">
        <input name="confirmationRequired" type="checkbox" />
        <span>Require confirmation before execution</span>
      </label>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.ok ? <p className="form-success">Command saved.</p> : null}

      <button
        type="submit"
        className="button-primary"
        disabled={isPending || devices.length === 0}
      >
        {isPending ? "Saving..." : "Create command"}
      </button>
    </form>
  );
}

export function DeviceEditForm({ device }) {
  const [state, formAction, isPending] = useActionState(
    updateDeviceAction,
    initialState
  );

  return (
    <form action={formAction} className="provider-form">
      <input type="hidden" name="deviceId" value={device.id} />

      <div className="form-grid">
        <label>
          <span>Name</span>
          <input name="name" type="text" defaultValue={device.name} required />
        </label>

        <label>
          <span>Type</span>
          <input name="type" type="text" defaultValue={device.type} required />
        </label>
      </div>

      <label>
        <span>Description</span>
        <textarea
          name="description"
          rows="3"
          defaultValue={device.description || ""}
          placeholder="Optional description for prompt context"
        />
      </label>

      <label>
        <span>Aliases JSON</span>
        <textarea
          name="aliasesJson"
          rows="3"
          defaultValue={
            device.aliases?.length > 0 ? JSON.stringify(device.aliases, null, 2) : ""
          }
          placeholder={'["燈","電燈","light"]'}
        />
      </label>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.ok ? <p className="form-success">Device updated.</p> : null}

      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Saving..." : "Update device"}
      </button>
    </form>
  );
}

export function CommandEditForm({ command }) {
  const [state, formAction, isPending] = useActionState(
    updateCommandAction,
    initialState
  );

  return (
    <form action={formAction} className="provider-form">
      <input type="hidden" name="commandId" value={command.id} />

      <div className="form-grid">
        <label>
          <span>Label</span>
          <input name="label" type="text" defaultValue={command.label} required />
        </label>

        <label>
          <span>Method</span>
          <select name="method" defaultValue={command.method}>
            <option value="POST">POST</option>
            <option value="GET">GET</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
        </label>

        <label>
          <span>Path</span>
          <input name="path" type="text" defaultValue={command.path} required />
        </label>

        <label>
          <span>Cooldown (sec)</span>
          <input
            name="cooldownSeconds"
            type="number"
            min="0"
            defaultValue={command.cooldownSeconds ?? 0}
          />
        </label>
      </div>

      <label>
        <span>Aliases JSON</span>
        <textarea
          name="aliasesJson"
          rows="3"
          defaultValue={
            command.aliases?.length > 0 ? JSON.stringify(command.aliases, null, 2) : ""
          }
          placeholder={'["打開","開燈","turn_on"]'}
        />
      </label>

      <label>
        <span>Payload template JSON</span>
        <textarea
          name="payloadTemplateJson"
          rows="4"
          defaultValue={command.payloadTemplateJson || ""}
          placeholder={'{"temperature":"{{temperature}}"}'}
        />
      </label>

      <label>
        <span>Args schema JSON</span>
        <textarea
          name="argsSchemaJson"
          rows="5"
          defaultValue={command.argsSchemaJson || ""}
          placeholder={
            '{"type":"object","properties":{"temperature":{"type":"number","minimum":18,"maximum":30}}}'
          }
        />
      </label>

      <label className="checkbox-row">
        <input
          name="confirmationRequired"
          type="checkbox"
          defaultChecked={command.confirmationRequired}
        />
        <span>Require confirmation before execution</span>
      </label>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.ok ? <p className="form-success">Command updated.</p> : null}

      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Saving..." : "Update command"}
      </button>
    </form>
  );
}

export function CommandDryRunForm({ command }) {
  const [state, formAction, isPending] = useActionState(
    dryRunCommandAction,
    { ok: false, error: "", message: "", details: "" }
  );

  return (
    <form action={formAction} className="provider-form">
      <input type="hidden" name="commandId" value={command.id} />

      <label>
        <span>Args JSON</span>
        <textarea
          name="argsJson"
          rows="4"
          placeholder={command.argsSchemaJson ? '{"state":"ON"}' : "{}"}
        />
      </label>

      {state.message ? <p className="form-success">{state.message}</p> : null}
      {state.details ? (
        <pre className="inline-code-block">{state.details}</pre>
      ) : null}
      {state.error ? <p className="form-error">{state.error}</p> : null}

      <button type="submit" className="button-secondary" disabled={isPending}>
        {isPending ? "Rendering..." : "Dry run"}
      </button>
    </form>
  );
}

export function TargetTestForm({ targetId }) {
  const [state, formAction, isPending] = useActionState(
    testTargetConnectionAction,
    { ok: false, error: "", message: "", details: "" }
  );

  return (
    <form action={formAction} className="provider-form">
      <input type="hidden" name="targetId" value={targetId} />

      {state.message ? <p className="form-success">{state.message}</p> : null}
      {state.details ? <p className="form-success">{state.details}</p> : null}
      {state.error ? <p className="form-error">{state.error}</p> : null}

      <button type="submit" className="button-secondary" disabled={isPending}>
        {isPending ? "Testing..." : "Test connection"}
      </button>
    </form>
  );
}
