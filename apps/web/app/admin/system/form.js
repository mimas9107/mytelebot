"use client";

import { useActionState } from "react";
import {
  createBackupAction,
  restoreBackupAction
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
