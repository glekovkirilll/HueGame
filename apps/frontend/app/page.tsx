import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="pill">HueGame Control Surface</span>
        <h1>Realtime room flows for host, voters, active player, and waiting joins</h1>
        <p>
          Frontend scaffold for the multiplayer game flow. This app is wired as a Next.js shell so
          we can connect it to the existing Nest websocket backend and iterate on role-based screens.
        </p>
        <div className="actions">
          <Link className="button" href="/host">
            Open Host Surface
          </Link>
          <Link className="button secondary" href="/player">
            Open Player Surface
          </Link>
          <Link className="button secondary" href="/active-player">
            Open Active Player
          </Link>
        </div>
      </section>

      <section className="grid two">
        <article className="panel">
          <h2>What This Scaffold Covers</h2>
          <ul>
            <li>Role-specific entry routes for host, voter, active player, and waiting joiner.</li>
            <li>Room summary cards that map directly to backend snapshots.</li>
            <li>A tiny websocket client helper ready for backend command wiring.</li>
          </ul>
        </article>
        <article className="panel">
          <h2>Next Frontend Steps</h2>
          <ul>
            <li>Connect routes to `socket.io-client` commands and hydrate from real snapshots.</li>
            <li>Render host-only reveal/result data based on backend phase visibility.</li>
            <li>Add form flows for create room, join room, reconnect, and betting actions.</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
