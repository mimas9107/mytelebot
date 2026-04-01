"use client";

import { useActionState } from "react";
import {
  createProviderAction,
  rotateProviderApiKeyAction,
  testProviderConnectionAction,
  updateProviderAction
} from "@/app/admin/providers/actions";

const initialState = {
  ok: false,
  error: ""
};

const capabilityProfileOptions = [
  { value: "openai_compatible", label: "OpenAI-compatible" },
  { value: "ollama_openai", label: "Ollama OpenAI-compatible" },
  { value: "generic", label: "Generic HTTP JSON" }
];

const jsonOutputModeOptions = [
  { value: "prompt_only", label: "Prompt-only JSON" },
  { value: "json_object", label: "response_format=json_object" }
];

export function ProviderCreateForm() {
  const [state, formAction, isPending] = useActionState(
    createProviderAction,
    initialState
  );

  return (
    <form action={formAction} className="provider-form">
      <div className="form-grid">
        <label>
          <span>Provider key</span>
          <input name="providerKey" type="text" placeholder="openrouter-main" required />
        </label>

        <label>
          <span>Name</span>
          <input name="name" type="text" placeholder="OpenRouter Main" required />
        </label>

        <label>
          <span>Base URL</span>
          <input
            name="baseUrl"
            type="url"
            placeholder="https://openrouter.ai/api/v1"
            required
          />
        </label>

        <label>
          <span>Model</span>
          <input name="model" type="text" placeholder="openai/gpt-4.1-mini" required />
        </label>
      </div>

      <label>
        <span>API key</span>
        <input name="apiKey" type="password" placeholder="sk-..." />
      </label>

      <label>
        <span>Extra headers JSON</span>
        <textarea
          name="extraHeadersJson"
          rows="4"
          placeholder={'{"HTTP-Referer":"https://example.com"}'}
        />
      </label>

      <label>
        <span>Capability profile</span>
        <select name="capabilityProfile" defaultValue="openai_compatible">
          {capabilityProfileOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>JSON output mode</span>
        <select name="jsonOutputMode" defaultValue="prompt_only">
          {jsonOutputModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="checkbox-row">
        <input name="jsonStrict" type="checkbox" />
        <span>Require strict JSON-only output</span>
      </label>

      <label>
        <span>Capabilities JSON</span>
        <textarea
          name="capabilitiesJson"
          rows="4"
          placeholder={'{"json_mode":true,"tool_calling":false}'}
        />
      </label>

      <label className="checkbox-row">
        <input name="makeDefault" type="checkbox" />
        <span>Set as active default provider</span>
      </label>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.ok ? <p className="form-success">Provider saved.</p> : null}

      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Saving..." : "Create provider"}
      </button>
    </form>
  );
}

export function ProviderTestForm({ providerId }) {
  const [state, formAction, isPending] = useActionState(
    testProviderConnectionAction,
    { ok: false, error: "", message: "", details: "" }
  );

  return (
    <form action={formAction} className="provider-form">
      <input type="hidden" name="providerId" value={providerId} />

      {state.message ? <p className="form-success">{state.message}</p> : null}
      {state.details ? <p className="form-success">{state.details}</p> : null}
      {state.error ? <p className="form-error">{state.error}</p> : null}

      <button type="submit" className="button-secondary" disabled={isPending}>
        {isPending ? "Testing..." : "Test connection"}
      </button>
    </form>
  );
}

export function ProviderEditForm({ provider }) {
  const [state, formAction, isPending] = useActionState(
    updateProviderAction,
    initialState
  );

  return (
    <form action={formAction} className="provider-form">
      <input type="hidden" name="providerId" value={provider.id} />

      <div className="form-grid">
        <label>
          <span>Name</span>
          <input name="name" type="text" defaultValue={provider.name} required />
        </label>

        <label>
          <span>Base URL</span>
          <input name="baseUrl" type="url" defaultValue={provider.baseUrl} required />
        </label>

        <label>
          <span>Model</span>
          <input name="model" type="text" defaultValue={provider.model} required />
        </label>
      </div>

      <label>
        <span>API key</span>
        <input
          type="password"
          defaultValue=""
          placeholder="Use Rotate API key below"
          disabled
        />
      </label>

      <label>
        <span>Extra headers JSON</span>
        <textarea
          name="extraHeadersJson"
          rows="4"
          defaultValue={provider.extraHeadersJson || ""}
          placeholder={'{"HTTP-Referer":"https://example.com"}'}
        />
      </label>

      <label>
        <span>Capability profile</span>
        <select name="capabilityProfile" defaultValue={provider.capabilityProfile}>
          {capabilityProfileOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>JSON output mode</span>
        <select name="jsonOutputMode" defaultValue={provider.jsonOutputMode}>
          {jsonOutputModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="checkbox-row">
        <input
          name="jsonStrict"
          type="checkbox"
          defaultChecked={provider.jsonStrict}
        />
        <span>Require strict JSON-only output</span>
      </label>

      <label>
        <span>Capabilities JSON</span>
        <textarea
          name="capabilitiesJson"
          rows="4"
          defaultValue={provider.capabilitiesJson || ""}
          placeholder={'{"json_mode":true,"tool_calling":false}'}
        />
      </label>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.ok ? <p className="form-success">Provider updated.</p> : null}

      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Saving..." : "Update provider"}
      </button>
    </form>
  );
}

export function ProviderRotateApiKeyForm({ providerId }) {
  const [state, formAction, isPending] = useActionState(
    rotateProviderApiKeyAction,
    { ok: false, error: "", message: "", details: "" }
  );

  return (
    <form action={formAction} className="provider-form">
      <input type="hidden" name="providerId" value={providerId} />

      <label>
        <span>New API key</span>
        <input
          name="apiKey"
          type="password"
          placeholder="sk-..."
          required
        />
      </label>

      <label className="checkbox-row">
        <input name="confirmRotation" type="checkbox" />
        <span>I understand this will replace the active provider secret</span>
      </label>

      {state.message ? <p className="form-success">{state.message}</p> : null}
      {state.details ? <p className="form-success">{state.details}</p> : null}
      {state.error ? <p className="form-error">{state.error}</p> : null}

      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Rotating..." : "Rotate API key"}
      </button>
    </form>
  );
}
