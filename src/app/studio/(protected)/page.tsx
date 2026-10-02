import Link from "next/link";
import { getDb } from "@/db/client";
import { MusicRepository } from "@/lib/music/repository";

export const dynamic = "force-dynamic";

export default async function StudioDashboard() {
  const db = getDb();
  const releases = await new MusicRepository(db).listReleases();

  return (
    <div className="studio-page">
      <header className="studio-head">
        <h1>Studio</h1>
        <nav className="studio-nav">
          <Link href="/studio/media">media</Link>
          <a href="/" target="_blank" rel="noreferrer">view site ↗</a>
        </nav>
      </header>

      <section className="studio-section">
        <div className="studio-section-head">
          <h2>Music</h2>
          <Link className="studio-new" href="/studio/releases/new">new release</Link>
        </div>
        {releases.map((release) => (
          <Link key={release.id} className="studio-row" href={`/studio/releases/${release.id}`}>
            <strong>{release.title}</strong>
            <span className={release.status === "published" ? "studio-status published" : "studio-status"}>
              {release.status}
            </span>
            <time>{release.updatedAt.toISOString().slice(0, 10)}</time>
          </Link>
        ))}
      </section>
    </div>
  );
}
