import Link from "next/link";

export default function NotFound() {
  return (
    <main id="top">
      <section className="nf-hero page-width">
        <h1>404</h1>
        <p>This page does not exist — ページが見つかりません — Хуудас олдсонгүй.</p>
        <Link className="text-link" href="/en">kotakunp →</Link>
      </section>
    </main>
  );
}
