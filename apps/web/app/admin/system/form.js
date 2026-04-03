"use client";

import { useActionState } from "react";
import {
  createBackupAction,
  restoreBackupAction,
  uploadBackupAction,
  updateRuntimeLoggingAction
} from "@/app/admin/system/actions";

export function BackupCreateForm() {
  const [state, formAction, isPending] = useActionState(
    createBackupAction,
    { ok: false, error: "", message: "", details: "" }
  );

  return (
    <form action={formAction} className="provider-form">
      <p className="auth-copy">
        Create a point-in-time SQLite snapshot in the configured backup directory.
      </p>

      {state.message ? <p className="form-success">{state.message}</p> : null}
      {state.details ? <p className="form-success">{state.details}</p> : null}
      {state.error ? <p className="form-error">{state.error}</p> : null}

      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Creating..." : "Create backup"}
      </button>
    </form>
  );
}

export function BackupRestoreForm({ filename }) {
  const [state, formAction, isPending] = useActionState(
    restoreBackupAction,
    { ok: false, error: "", message: "", details: "" }
  );

  return (
    <form action={formAction} className="provider-form">
      <input type="hidden" name="filename" value={filename} />

      <p className="auth-copy">
        Restore this backup into the live SQLite file. A pre-restore backup will be created automatically.
      </p>

      {state.message ? <p className="form-success">{state.message}</p> : null}
      {state.details ? <p className="form-success">{state.details}</p> : null}
      {state.error ? <p className="form-error">{state.error}</p> : null}

      <button type="submit" className="button-danger" disabled={isPending}>
        {isPending ? "Restoring..." : "Restore backup"}
      </button>
    </form>
  );
}

export function BackupUploadForm() {
  const [state, formAction, isPending] = useActionState(
    uploadBackupAction,
    { ok: false, error: "", message: "", details: "" }
  );

  return (
    <form action={formAction} className="provider-form">
      <p className="auth-copy">
        Upload a `.sqlite` backup into the configured backup directory. You can optionally restore
        it immediately after validation.
      </p>

      {state.message ? <p className="form-success">{state.message}</p> : null}
      {state.details ? <p className="form-success">{state.details}</p> : null}
      {state.error ? <p className="form-error">{state.error}</p> : null}

      <label className="provider-field">
        <span>Backup file</span>
        <input type="file" name="backupFile" accept=".sqlite" required />
      </label>

      <label className="provider-toggle">
        <input type="checkbox" name="restoreAfterUpload" defaultChecked={false} />
        <span>Restore immediately after upload</span>
      </label>

      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Uploading..." : "Upload backup"}
      </button>
    </form>
  );
}

export function RuntimeLoggingForm({ verboseServerLogs }) {
  const [state, formAction, isPending] = useActionState(
    updateRuntimeLoggingAction,
    { ok: false, error: "", message: "", details: "" }
  );

  return (
    <form action={formAction} className="provider-form">
      <p className="auth-copy">
        Toggle verbose `info`-level server logs without restarting or redeploying. `warn` and
        `error` logs stay enabled even when verbose logging is off.
      </p>

      {state.message ? <p className="form-success">{state.message}</p> : null}
      {state.details ? <p className="form-success">{state.details}</p> : null}
      {state.error ? <p className="form-error">{state.error}</p> : null}

      <label className="provider-toggle">
        <input type="checkbox" name="verboseServerLogs" defaultChecked={verboseServerLogs} />
        <span>Enable verbose server logs</span>
      </label>

      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Saving..." : "Save logging settings"}
      </button>
    </form>
  );
}
