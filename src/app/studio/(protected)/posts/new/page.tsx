"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NewPostPage() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/studio/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled draft" }),
      });
      if (!response.ok) return;
      const body = (await response.json()) as { data: { post: { id: string } } };
      router.replace(`/studio/posts/${body.data.post.id}`);
    })();
  }, [router]);

  return <p className="studio-page">Creating draft…</p>;
}
