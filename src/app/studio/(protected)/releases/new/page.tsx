"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NewReleasePage() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/studio/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled release" }),
      });
      if (!response.ok) return;
      const body = (await response.json()) as { data: { release: { id: string } } };
      router.replace(`/studio/releases/${body.data.release.id}`);
    })();
  }, [router]);

  return <p className="studio-page">Creating release draft…</p>;
}
