import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { listPublishedPosts } from "@/lib/journal/queries";
import { OgCard, ogSize } from "@/lib/og-card";

export const size = ogSize;
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = (await listPublishedPosts()).find((candidate) => candidate.slug === slug);
  if (!post) notFound();
  const sub =
    post.excerpt.length > 90
      ? post.excerpt.slice(0, post.excerpt.lastIndexOf(" ", 90)) + "…"
      : post.excerpt;
  return new ImageResponse(<OgCard tag={post.type} title={post.title} sub={sub} />, size);
}
