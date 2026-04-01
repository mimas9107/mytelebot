"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/login/actions";

const initialState = {
  error: ""
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="auth-form">
      <label>
        <span>Username</span>
        <input name="username" type="text" autoComplete="username" required />
      </label>

      <label>
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      {state?.error ? <p className="form-error">{state.error}</p> : null}

      <button type="submit" className="button-primary" disabled={isPending}>
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
