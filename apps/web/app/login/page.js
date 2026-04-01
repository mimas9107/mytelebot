import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureBootstrapAdmin } from "@/lib/auth/bootstrap";
import { getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "@/app/login/form";

export default async function LoginPage() {
  const bootstrap = await ensureBootstrapAdmin();
  const sessionUser = await getSessionUser();
  const hasSessionSecret = Boolean(process.env.SESSION_SECRET);

  if (sessionUser?.role === "admin") {
    redirect("/admin");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Admin access</p>
        <h1>Sign in to MyTeleBot</h1>
        <p className="auth-copy">
          Use the bootstrap admin credentials from `.env` to enter the control
          panel prototype.
        </p>

        {!bootstrap.ready ? (
          <div className="notice-block">
            <p>
              `ADMIN_USER` and `ADMIN_PASSWORD` are required before login can
              work.
            </p>
          </div>
        ) : !hasSessionSecret ? (
          <div className="notice-block">
            <p>`SESSION_SECRET` is required before login can create sessions.</p>
          </div>
        ) : (
          <LoginForm />
        )}

        <p className="auth-footer">
          <Link href="/">Back to project overview</Link>
        </p>
      </section>
    </main>
  );
}
