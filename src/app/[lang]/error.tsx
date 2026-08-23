"use client";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="page-width nf-hero">
      <h1>—</h1>
      <p>Something went wrong. Try again.</p>
      <button type="button" className="text-link retry-button" onClick={() => retry()}>retry →</button>
    </main>
  );
}
