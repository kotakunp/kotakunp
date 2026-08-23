import { listPublishedPosts } from "@/lib/journal/queries";
import { rssItem } from "@/lib/rss";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function GET() {
  const posts = await listPublishedPosts();
  const items = posts
    .map((post) =>
      rssItem({
        title: post.title,
        link: `${siteUrl}/en/journal/${post.slug}`,
        description: post.excerpt,
        pubDate: new Date(post.publishedAt).toUTCString(),
      }),
    )
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>kotakunp — journal</title>`,
    `    <link>${siteUrl}/en/journal</link>`,
    `    <description>Notes from the space between songs.</description>`,
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
