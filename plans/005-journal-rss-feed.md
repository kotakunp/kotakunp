# Plan 005: RSS feed for the journal

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6bc950a..HEAD -- src/content/journal.ts src/app/[lang]/layout.tsx src/app`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `6bc950a`, 2026-08-21

## Why this matters

The journal is hand-written MDX with stable metadata — everything an RSS feed
needs — but readers have no way to subscribe. A static `/feed.xml` route plus
an autodiscovery `<link>` makes the journal subscribable for near-zero
maintenance cost.

## Current state

- `src/content/journal.ts` exports `journalPosts`, an array of
  `{ metadata: JournalMetadata; Content }` where:
  ```ts
  // src/content/journal.ts:6-14
  export type JournalMetadata = {
    title: string;
    slug: string;
    date: string;        // "2026-04-12" ISO date strings
    type: string;
    excerpt: string;
    cover: string;
    readingTime: string;
  };
  ```
  Posts are ordered newest-first in the array.
- Post metadata lives as `export const metadata = {...}` inside each MDX file
  (e.g. `src/content/posts/notes-before-the-voice.mdx:1-9`).
- `src/app/[lang]/layout.tsx` builds metadata via `generateMetadata` and
  returns an object with `title`, `description`, `metadataBase`,
  `openGraph`, `twitter`. The `metadataBase` uses
  `process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"`.
- Route handlers live under `src/app/api/...` today; a metadata route file
  convention (`src/app/feed.xml/route.ts`) is equally valid and keeps the URL
  clean.
- Build output confirms routes prerender statically unless marked dynamic.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint    | `npm run lint`  | exit 0 |
| Build   | `npm run build` | exit 0; route table lists `○ /feed.xml` (static) |
| Dev server | `npm run dev` | serves on :3000 |

## Scope

**In scope**:
- `src/app/feed.xml/route.ts` (create)
- `src/lib/rss.ts` (create — escape helper + item builder)
- `src/app/[lang]/layout.tsx` (modify — add autodiscovery link to metadata)

**Out of scope**:
- Atom/JSON Feed variants (RSS 2.0 only).
- Full-content feeds (excerpt-only; posts are MDX-rendered pages).
- Per-locale feeds (posts are English-only today regardless of locale).

## Git workflow

- Branch: `advisor/005-journal-rss`
- Commit per step; short imperative lowercase messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: RSS builder helper

Create `src/lib/rss.ts`:

```ts
export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function rssItem({ title, link, description, pubDate }: { title: string; link: string; description: string; pubDate: string }): string {
  return [
    "    <item>",
    `      <title>${escapeXml(title)}</title>`,
    `      <link>${escapeXml(link)}</link>`,
    `      <guid>${escapeXml(link)}</guid>`,
    `      <pubDate>${pubDate}</pubDate>`,
    `      <description>${escapeXml(description)}</description>`,
    "    </item>",
  ].join("\n");
}
```

**Verify**: `npx tsc --noEmit` (after one `npm run build` so route types exist) → exit 0.

### Step 2: The feed route

Create `src/app/feed.xml/route.ts`:

```ts
import { journalPosts } from "@/content/journal";
import { rssItem } from "@/lib/rss";

export const dynamic = "force-static";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function GET() {
  const items = journalPosts
    .map(({ metadata }) =>
      rssItem({
        title: metadata.title,
        link: `${siteUrl}/en/journal/${metadata.slug}`,
        description: metadata.excerpt,
        pubDate: new Date(metadata.date).toUTCString(),
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

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
```

**Verify**: `npm run build` → exit 0; the route table lists `○ /feed.xml`.

### Step 3: Autodiscovery link

In `src/app/[lang]/layout.tsx`, extend the returned metadata object in
`generateMetadata` (after `metadataBase`):

```ts
alternates: {
  types: { "application/rss+xml": `${siteUrl}/feed.xml` },
},
```

Hoist `const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";`
to the top of the function and reuse it for the existing `metadataBase` line
so the two cannot drift.

**Verify**: `npm run build` → exit 0.

### Step 4: Runtime verification

Start `npm run dev`, then:

```sh
curl -s http://localhost:3000/feed.xml -o /tmp/feed.xml -w "%{content_type}\n"
# expect: application/rss+xml; charset=utf-8
grep -c "<item>" /tmp/feed.xml        # expect 3
python3 -c "import xml.dom.minidom; xml.dom.minidom.parse('/tmp/feed.xml'); print('well-formed')"
# expect: well-formed
curl -s http://localhost:3000/en | grep -c 'application/rss+xml'
# expect >= 1 (autodiscovery link present)
```

## Test plan

No test framework exists. Step 4's curl matrix is the test plan: correct
MIME, three items (one per MDX post), XML well-formedness via Python's
stdlib parser, and autodiscovery presence in rendered HTML.

## Done criteria

- [ ] `npm run lint` exits 0; `npm run build` exits 0 with `○ /feed.xml` listed
- [ ] `/feed.xml` returns `application/rss+xml`, exactly 3 `<item>` elements, well-formed XML
- [ ] Every page under `[lang]` includes the RSS autodiscovery `<link>`
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `journalPosts` shape no longer matches the `JournalMetadata` excerpt.
- `force-static` on the route causes a build error about used runtime APIs.
- Any step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- New posts are picked up automatically (the route imports `journalPosts`);
  nothing to update when publishing.
- If posts ever become locale-aware, split this into `/[lang]/feed.xml` and
  filter by locale.
- Item links hardcode `/en/` because post content is English-only today; if
  that changes, revisit.
- Optional follow-up (not in scope): advertise `/feed.xml` in `robots.ts`
  (`Sitemap:`-style) or as a sitemap entry — low value while the feed is
  young; autodiscovery via the `<link>` already covers subscribers.
