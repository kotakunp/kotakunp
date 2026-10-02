import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getJournalPost } from "@/content/journal";
import { OgCard, ogSize } from "@/lib/og-card";

export const size = ogSize;
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getJournalPost(slug);
  if (!post) notFound();
  const sub =
    post.excerpt.length > 90
      ? post.excerpt.slice(0, post.excerpt.lastIndexOf(" ", 90)) + "…"
      : post.excerpt;
  return new ImageResponse(<OgCard tag={post.type} title={post.title} sub={sub} />, size);
}
