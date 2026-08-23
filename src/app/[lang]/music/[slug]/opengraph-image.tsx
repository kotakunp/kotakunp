import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getPublishedRelease } from "@/lib/music/queries";
import { OgCard, ogSize } from "@/lib/og-card";

export const size = ogSize;
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const release = await getPublishedRelease(slug);
  if (!release) notFound();
  return new ImageResponse(
    <OgCard tag={release.type ?? "music"} title={release.englishTitle} sub={release.descriptionMarkdown} />,
    size,
  );
}
