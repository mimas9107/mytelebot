import Link from "next/link";

const setupChecklist = [
  "Bootstrap admin login",
  "Prisma + SQLite schema",
  "Provider registry CRUD",
  "Telegram webhook endpoint",
  "Device registry and dispatcher"
];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Render-first prototype</p>
        <h1>MyTeleBot</h1>
        <p className="lead">
          Telegram bot control plane for model switching, device orchestration,
          and audited home automation.
        </p>
      </section>

      <section className="card-grid">
        <article className="card">
          <h2>Current baseline</h2>
          <ul>
            <li>Node 24 workspace pinned</li>
            <li>Next.js app skeleton created</li>
            <li>SQLite connected through Prisma</li>
          </ul>
          <p className="card-link">
            <Link href="/login">Open admin login</Link>
          </p>
        </article>

        <article className="card">
          <h2>Next build targets</h2>
          <ol>
            {setupChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>
      </section>
    </main>
  );
}
