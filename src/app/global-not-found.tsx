import "./globals.css";
import Link from "next/link";

export const metadata = { title: "404 — kotakunp" };

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body style={{ background: "#f8f7f3", color: "#17191a" }}>
        <main className="page-width nf-hero" style={{ minHeight: "100vh" }}>
          <h1>404</h1>
          <p>This page does not exist — ページが見つかりません — Хуудас олдсонгүй.</p>
          <Link className="text-link" href="/en">kotakunp →</Link>
        </main>
      </body>
    </html>
  );
}
