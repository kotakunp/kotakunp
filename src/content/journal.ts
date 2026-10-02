import { readingTimeMinutes } from "@/lib/journal/reading-time";

export type JournalTag = { name: string; slug: string };

export type JournalPost = {
  slug: string;
  title: string;
  excerpt: string;
  type: string;
  /** Optional static image path (e.g. "/covers/rain-city.webp"). */
  coverPath: string | null;
  coverAlt: string | null;
  /** ISO date string. Used for ordering and the displayed date. */
  publishedAt: string;
  tags: JournalTag[];
  bodyMarkdown: string;
};

export type JournalPostView = JournalPost & {
  readingTimeMinutes: number;
};

export type AdjacentPostsView = {
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

/**
 * Newest first. Add new posts to the top of this list, or anywhere in it —
 * ordering is derived from `publishedAt` at read time, not from position.
 *
 * Every post here is public. There are no drafts: if it is in this file, it is
 * on the site. Delete the entry to unpublish.
 */
const POSTS: JournalPost[] = [
  {
    slug: "transparent-city-and-rain",
    title: "The weather inside a transparent city",
    excerpt: "A few notes about rain, memory, and the first song in the archive.",
    type: "release note",
    coverPath: "/covers/rain-city.webp",
    coverAlt: "Rain falling over a pale transparent city",
    publishedAt: "2026-05-01",
    tags: [{ name: "release", slug: "release" }],
    bodyMarkdown: `# The weather inside a transparent city

The first image I had for this song was not a melody. It was a wet street after the last train had gone home.

I wanted the arrangement to feel like walking through a place you recognize but cannot quite name. The drums stay small and close. The vocal sits just above the pavement. Everything else is allowed to blur at the edges.

> Some songs begin as a room. This one began as weather.

## Small sounds

The quiet details carry most of the weight: a muted kick, a breath before the chorus, and a synth line that arrives a little late. Those imperfections make the synthetic voice feel less like a machine and more like a memory trying to return.

The release is still a small beginning, but it gave the rest of the archive somewhere to stand.
`,
  },
  {
    slug: "notes-before-the-voice",
    title: "Notes before the voice arrives",
    excerpt: "What I listen for before opening a synth, a session, or a blank page.",
    type: "studio note",
    coverPath: "/covers/glass-flowers.webp",
    coverAlt: "Glass flowers on a windowsill in low light",
    publishedAt: "2026-04-12",
    tags: [{ name: "process", slug: "process" }],
    bodyMarkdown: `# Notes before the voice arrives

Before I choose a singer, I try to understand what the song is already saying without one.

There is usually a shape hidden in the first sketch: a rhythm that wants to keep moving, a chord that refuses to resolve, or a patch that sounds better when it is almost too quiet. I keep those clues around while the arrangement grows.

## A little space

Synthetic voices become expressive when they have somewhere to breathe. I leave gaps between phrases and let the consonants arrive with their own timing. The goal is not to make the voice human. The goal is to make the feeling clear.

The rest is editing: remove what is decorative, keep what is honest, and listen again the next morning.
`,
  },
  {
    slug: "building-a-small-listening-room",
    title: "Building a small listening room",
    excerpt: "Why this website is intentionally quiet, spacious, and a little unfinished.",
    type: "field note",
    coverPath: "/covers/white-field.webp",
    coverAlt: "A white field under an overcast sky",
    publishedAt: "2026-03-28",
    tags: [
      { name: "process", slug: "process" },
      { name: "site", slug: "site" },
    ],
    bodyMarkdown: `# Building a small listening room

I wanted this website to feel closer to entering a record sleeve than opening a dashboard.

There are no urgent counters here. A song can sit with an illustration. A note can take a few lines before it says what it means. The generous margins are part of the music.

## A place to return to

The journal is for the pieces that do not fit inside a release description: process notes, unfinished thoughts, translations, and the small discoveries that happen between songs.

It will grow slowly. That is intentional. A quiet archive has its own kind of rhythm.
`,
  },
];

function byNewest(a: JournalPost, b: JournalPost): number {
  const delta = b.publishedAt.localeCompare(a.publishedAt);
  return delta !== 0 ? delta : b.slug.localeCompare(a.slug);
}

const SORTED = [...POSTS].sort(byNewest);

function toView(post: JournalPost): JournalPostView {
  return { ...post, readingTimeMinutes: readingTimeMinutes(post.bodyMarkdown) };
}

/** All posts, newest first. Pass a tag slug to filter. */
export function listJournalPosts(tagSlug?: string): JournalPostView[] {
  if (tagSlug === undefined) return SORTED.map(toView);
  return SORTED.filter((post) => post.tags.some((tag) => tag.slug === tagSlug)).map(toView);
}

export function getJournalPost(slug: string): JournalPostView | null {
  const found = SORTED.find((post) => post.slug === slug);
  return found ? toView(found) : null;
}

/** Only tags actually used by at least one post, alphabetically by name. */
export function listJournalTags(): JournalTag[] {
  const seen = new Map<string, JournalTag>();
  for (const post of SORTED) {
    for (const tag of post.tags) {
      if (!seen.has(tag.slug)) seen.set(tag.slug, tag);
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getAdjacentJournalPosts(slug: string): AdjacentPostsView {
  const index = SORTED.findIndex((post) => post.slug === slug);
  if (index === -1) return { previous: null, next: null };
  const pick = (post: JournalPost | undefined) =>
    post ? { slug: post.slug, title: post.title } : null;
  return {
    previous: pick(SORTED[index + 1]),
    next: pick(SORTED[index - 1]),
  };
}