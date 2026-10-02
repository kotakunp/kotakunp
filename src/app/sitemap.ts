import type { MetadataRoute } from "next";
import { listJournalPosts } from "@/content/journal";
import { listPublishedReleases } from "@/lib/music/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const pages = ["", "/about", "/music", "/projects", "/journal", "/contact"];
  const locales = ["en", "ja", "mn"];

  const releases = await listPublishedReleases();
  const posts = listJournalPosts();

  return locales.flatMap((locale) => {
    const pageUrls: MetadataRoute.Sitemap = pages.map((page) => ({
      url: `${baseUrl}/${locale}${page}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: page === "" ? (locale === "en" ? 1 : 0.8) : 0.7,
    }));
    const postUrls: MetadataRoute.Sitemap = posts.map((post) => ({
      url: `${baseUrl}/${locale}/journal/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly",
      priority: 0.6,
    }));
    const releaseUrls: MetadataRoute.Sitemap = releases.map((release) => ({
      url: `${baseUrl}/${locale}/music/${release.slug}`,
      lastModified: release.releaseDate ? new Date(release.releaseDate) : new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    }));
    return [...pageUrls, ...postUrls, ...releaseUrls];
  });
}
