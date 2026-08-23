# Plan 006: Dynamic OG images for releases and journal posts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6bc950a..HEAD -- src/app/[lang] src/content`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition — EXCEPT plans/005's edits to
> `layout.tsx` (the `alternates.types` RSS entry and a hoisted `siteUrl`
> const are expected and do not touch the OG excerpts). This plan REQUIRES
> plan 001 to be DONE (the `src/app/[lang]/music/[slug]` route must exist).

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-release-detail-pages.md (must be landed first — see `plans/README.md` for live status)
- **Category**: direction
- **Planned at**: commit `6bc950a`, 2026-08-21

## Why this matters

Every page shares one static OG image (`/hero-clean.png`,
`src/app/[lang]/layout.tsx:38`). Shared links to a specific release or journal
post render a generic hero instead of that content. Next's `opengraph-image`
file convention with `ImageResponse` generates branded per-route cards at
build time — no external service.

## Current state

- Layout metadata (`src/app/[lang]/layout.tsx:34-46`) sets
  `openGraph.images: [{ url: "/hero-clean.png", width: 1536, height: 1024 }]`
  and `twitter.card: "summary_large_image"`.
- The bundled doc for the convention is at
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`;
  it shows `import { ImageResponse } from 'next/og'`, `export const size` /
  `export const contentType`, and `generateStaticParams` support for dynamic
  segments. Read it before writing the files.
- Design tokens (`src/app/globals.css:3`): paper `#f8f7f3`, ink `#17191a`,
  muted `#626561`, rule `#d9d7d1`. Brand aesthetic: monospace, hairline rules,
  small tags.
- Content sources:
  - Releases: `releases` in `src/content/site.ts` (fields `title, englishTitle,
    type, date, cover, slug`).
  - Posts: `journalPosts` in `src/content/journal.ts` (`metadata.title`,
    `metadata.excerpt`, `metadata.date`).
- **Font constraint**: `ImageResponse` (satori) renders without system fonts.
  The locale dictionary titles are NON-LATIN — `ja.json` meta.title is
  `"kotakunp — 静かな時間のための音楽"` and `mn.json` is
  `"kotakunp — нам гүм цагийн хөгжим"` (Cyrillic). Both would throw in satori
  without an embedded font. This plan therefore HARDCODES the English
  branding string on all OG cards and uses only English content fields
  (`englishTitle`, post titles/excerpts are English). Do not feed any
  dictionary string into `ImageResponse`.
- **Layout conflict**: `src/app/[lang]/layout.tsx` sets
  `openGraph.images: ["/hero-clean.png"]` (lines 38, 44). Once the
  `[lang]/opengraph-image.tsx` file convention exists it takes precedence for
  every route beneath `[lang]`, making those layout entries dead config.
  Step 4 removes them so there is exactly one OG image source of truth.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint    | `npm run lint`  | exit 0 |
| Build   | `npm run build` | exit 0; build log lists opengraph-image routes |
| Dev server | `npm run dev` | serves on :3000 |

## Scope

**In scope**:
- `src/lib/og-card.tsx` (create — shared card layout)
- `src/app/[lang]/opengraph-image.tsx` (create)
- `src/app/[lang]/music/[slug]/opengraph-image.tsx` (create)
- `src/app/[lang]/journal/[slug]/opengraph-image.tsx` (create)
- `src/app/[lang]/layout.tsx` (modify — remove shadowed OG image entries)

**Out of scope**:
- Embedding cover art bitmaps into cards (typographic cards only; keeps the
  edge runtime happy and builds fast).
- Twitter-specific image variants (the convention serves both).

## Git workflow

- Branch: `advisor/006-dynamic-og-images`
- Commit per step; short imperative lowercase messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Shared card component

Create `src/lib/og-card.tsx`. Satori requires explicit `display: "flex"` on
every div — omitting it on nested containers is a common build-time throw:

```tsx
export const ogSize = { width: 1200, height: 630 };

export function OgCard({ tag, title, sub }: { tag: string; title: string; sub?: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      justifyContent: "space-between", padding: 72, background: "#f8f7f3", color: "#17191a",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#626561" }}>
        <span>kotakunp</span>
        <span>{tag}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", width: 64, height: 2, background: "#17191a" }} />
        <div style={{ display: "flex", fontSize: title.length > 32 ? 56 : 72, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
        {sub ? <div style={{ display: "flex", fontSize: 28, color: "#626561" }}>{sub}</div> : null}
      </div>
    </div>
  );
}
```

**Verify**: `npx tsc --noEmit` (after one `npm run build`) → exit 0.

### Step 2: Locale-level card

Create `src/app/[lang]/opengraph-image.tsx`. The title is the HARDCODED
English branding string — do NOT read `dictionary.meta.title`, because the
ja/mn dictionaries contain Japanese/Cyrillic text that satori cannot render
without an embedded font:

```tsx
import { ImageResponse } from "next/og";
import { OgCard, ogSize } from "@/lib/og-card";

export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <OgCard tag="home" title="kotakunp — music for the quiet hours" />,
    size,
  );
}
```

**Verify**: `npm run build` → exit 0.

### Step 3: Release + post cards

Create `src/app/[lang]/music/[slug]/opengraph-image.tsx`:

```tsx
import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { releases } from "@/content/site";
import { OgCard, ogSize } from "@/lib/og-card";
import { releaseDetails } from "@/content/release-details";

export const size = ogSize;
export const contentType = "image/png";

export function generateStaticParams() {
  return releases.map(({ slug }) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const release = releases.find((r) => r.slug === slug);
  if (!release) notFound();
  const description = releaseDetails[slug]?.description;
  return new ImageResponse(
    <OgCard tag={release.type} title={release.englishTitle} sub={description} />,
    size,
  );
}
```

Create `src/app/[lang]/journal/[slug]/opengraph-image.tsx` identically but
over `journalPosts` / `getJournalPost` from `@/content/journal`, with
`tag={post.metadata.type}`, `title={post.metadata.title}` (post titles are
English), and `sub` = excerpt truncated to ~90 chars at a word boundary:

```ts
const sub = post.metadata.excerpt.length > 90
  ? post.metadata.excerpt.slice(0, post.metadata.excerpt.lastIndexOf(" ", 90)) + "…"
  : post.metadata.excerpt;
```

**Verify**: `npm run build` → exit 0; the build output/log references the new
image routes under their segments.

### Step 4: Remove the shadowed layout OG entries

In `src/app/[lang]/layout.tsx`, delete from `generateMetadata`:

- line 38: `images: [{ url: "/hero-clean.png", width: 1536, height: 1024 }],`
  (inside `openGraph`)
- line 44: `images: ["/hero-clean.png"],` (inside `twitter`)

The `[lang]/opengraph-image.tsx` file convention now serves every route under
`[lang]` (most-specific file wins per the Next docs), so these entries are
dead config that would only confuse future readers. Keep
`twitter.card: "summary_large_image"`.

**Verify**: `npm run build` → exit 0.

### Step 5: Runtime verification

Start `npm run dev`, then:

```sh
curl -s -o /tmp/og-release.png -w "%{http_code} %{content_type} %{size_download}\n" \
  http://localhost:3000/en/music/transparent-city-and-rain/opengraph-image
# expect: 200 image/png and size_download > 10000
curl -s -o /tmp/og-post.png -w "%{http_code} %{content_type}\n" \
  http://localhost:3000/en/journal/notes-before-the-voice/opengraph-image
# expect: 200 image/png
file /tmp/og-release.png   # expect: PNG image data, 1200 x 630
```

Manual browser pass: paste the two URLs into a browser; confirm legible
branded cards (paper background, ink type, wordmark row). Then confirm share
targets: view-source of `/en/music/transparent-city-and-rain` contains
exactly one `og:image`, pointing at the route URL (not `/hero-clean.png`);
`/en/about` also carries the `[lang]` card via inheritance.

## Test plan

No test framework exists. Step 5's curl matrix plus visual inspection is the
test plan: correct dimensions/MIME, per-content titles rendered, single
`og:image` meta present on detail pages AND inherited pages.

## Done criteria

- [ ] `npm run lint` exits 0; `npm run build` exits 0
- [ ] Both curl checks return `200 image/png`; PNG dimensions are 1200×630
- [ ] `grep -c "hero-clean" src/app/[lang]/layout.tsx` → 0
- [ ] view-source of a release detail page includes exactly one `og:image`, pointing at its own route URL
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Plan 001's `[slug]` route does not exist — execute plans/001 first.
- Satori throws on any string you feed it (unsupported glyph) — switch that
  string to its English counterpart; if none exists, report.
- The `ImageResponse` import path `next/og` fails to resolve (dependency
  drift) — report; do not add manual font/polyfill machinery.
- Any step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- New releases/posts get OG cards automatically via `generateStaticParams` +
  the content arrays; no per-item work.
- Cards are intentionally typographic and English-only. If localized or
  cover-art compositing is wanted later, it requires embedding a font subset
  (satori `fonts` option) and/or moving to a Node runtime with `fs` reads of
  `public/covers` — deliberate changes, not drive-bys.
- Reviewers should reject any PR feeding dictionary strings into
  `ImageResponse` (ja/mn titles are non-Latin) without also embedding a
  matching font subset.
