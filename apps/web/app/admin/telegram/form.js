"use client";

import { useActionState } from "react";
import {
  createTelegramAccountAction,
  updateTelegramAccountAction
} from "@/app/admin/telegram/actions";

const initialState = {
  ok: false,
  error: ""
};

function AdminUserSelect({ users, defaultValue = "" }) {
  return (
    <label>
      <span>Linked admin user</span>
      <select name="userId" defaultValue={defaultValue}>
        <option value="">Not linked</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.username}{user.name ? ` (${user.name})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TelegramAccountForm({ users }) {
  const [state, formAction, isPending] = useActionState(
    createTelegramAccountAction,
    initialState
  );

  return (
    <form action={formAction} className="provider-form">
      <div className="form-grid">
        <label>
          <span>Telegram user ID</span>
          <input name="telegramUserId" type="text" placeholder="123456789" required />
        </label>

        <label>
          <span>Username</span>
          <input name="username" type="text" placeholder="$ADMIN_USER" />
        </label>

        <label>
          <span>Display name</span>
          <input name="displayName" type="text" placeholder="Mimas" />
        </label>

        <AdminUserSelect users={users} />
      </div>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.ok ? <p className="form-success">Telegram account saved.</p> : null}

      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Saving..." : "Add allowlist account"}
      </button>
    </form>
  );
}

export function TelegramAccountEditForm({ account, users }) {
  const [state, formAction, isPending] = useActionState(
    updateTelegramAccountAction,
    initialState
  );

  return (
    <form action={formAction} className="provider-form">
      <input type="hidden" name="accountId" value={account.id} />

      <div className="form-grid">
        <label>
          <span>Username</span>
          <input
            name="username"
            type="text"
            defaultValue={account.username || ""}
            placeholder="$ADMIN_USER"
          />
        </label>

        <label>
          <span>Display name</span>
          <input
            name="displayName"
            type="text"
            defaultValue={account.displayName || ""}
            placeholder="Mimas"
          />
        </label>

        <AdminUserSelect users={users} defaultValue={account.userId || ""} />
      </div>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.ok ? <p className="form-success">Telegram account updated.</p> : null}

      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Saving..." : "Update account"}
      </button>
    </form>
  );
}
