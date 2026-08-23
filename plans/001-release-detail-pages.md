# Plan 001: Release detail pages with tracklists and lyrics

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6bc950a..HEAD -- src/app/[lang]/music src/content/site.ts src/components/release-card.tsx src/app/globals.css src/app/sitemap.ts src/messages`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `6bc950a`, 2026-08-21

## Why this matters

The music page renders six releases, each carrying a `slug`, but no route
serves `/[lang]/music/[slug]`. The cards' "listen →" and "lyrics →" actions
are dead `<span>`s (`src/components/release-card.tsx:15`), as are the
featured block's links on the music page. This plan adds the missing detail
pages (the deepest content surface for a music site), a per-release content
module for tracklists/lyrics/description, functional discography type
filters, and wires the listen links to the new route. "Lyrics →" becomes a
real link ONLY where lyrics are seeded — none are today, so those spans stay
inert by design until the maintainer supplies lyrics (the mechanism is what
this plan delivers).

## Current state

- `src/content/site.ts` — content-as-code store. Exports `releases` (6 items,
  `as const`, fields: `slug, title, englishTitle, type, date, tracks, duration,
  cover`) and `featuredTracks` (4 items `{ number, title, duration }`, sample
  tracklist for the latest release). Slugs: `transparent-city-and-rain`,
  `white-daydream-record`, `after-the-end-roll`, `grey-morning`,
  `journey-without-a-terminus`, `sound-that-clears-the-night`.
- `src/components/release-card.tsx` — server component; card actions are
  non-links:
  ```tsx
  // src/components/release-card.tsx:15
  <div className="card-actions"><span>listen →</span>{detailed ? <span>lyrics →</span> : <Play className="play-icon" aria-label="Play" size={14} fill="currentColor" />}</div>
  ```
- `src/app/[lang]/music/page.tsx` — discography section renders all releases;
  filter nav is decorative spans:
  ```tsx
  // src/app/[lang]/music/page.tsx:33
  <nav className="filter-nav"><span className="active">all</span><span>single</span><span>ep</span><span>album</span><span>ost</span></nav>
  ```
- `src/app/[lang]/journal/[slug]/page.tsx` — **the exemplar to copy** for the
  dynamic route shape:
  ```tsx
  // src/app/[lang]/journal/[slug]/page.tsx:10-14
  export function generateStaticParams() {
    return locales.flatMap((lang) => journalPosts.map(({ metadata }) => ({ lang, slug: metadata.slug })));
  }
  export const dynamicParams = false;
  export async function generateMetadata({ params }: JournalRouteProps): Promise<Metadata> { ... }
  ```
- Route params in this Next version are promises: `const { lang } = await params;`
  and page props use the generated global helper `PageProps<"/[lang]/music/[slug]">`.
- Dictionaries: `getDictionary(lang)` / `isLocale(lang)` from
  `src/app/[lang]/dictionaries.ts`; invalid locale → `notFound()`.
- Styling: hand-written dense CSS appended to `src/app/globals.css`
  (Tailwind is imported but unused for layout). Existing classes to reuse:
  `.track-list` (grid rows `30px 1fr auto`), `.tag`, `.section-title`,
  `.release-cover`, `.page-width`, `.ruled-section`.
- Icons: `lucide-react`, small sizes (`size={10}`–`size={19}`,
  `strokeWidth={1.7}`).

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Lint      | `npm run lint`   | exit 0              |
| Build     | `npm run build`  | exit 0; route table lists `/[lang]/music/[slug]` with 18 SSG paths |
| Dev server| `npm run dev`    | serves on :3000     |

There is no test framework in this repo. `npm run build` also generates the
typed-route helpers (`PageProps<...>`), so run it after adding any new route
before relying on the type in the page file.

## Scope

**In scope** (the only files you should modify or create):
- `src/content/release-details.ts` (create)
- `src/app/[lang]/music/[slug]/page.tsx` (create)
- `src/components/discography-filter.tsx` (create)
- `src/components/release-card.tsx` (modify)
- `src/app/[lang]/music/page.tsx` (modify — filter + featured-block links)
- `src/app/[lang]/page.tsx` (modify — pass `locale` to `ReleaseCard`)
- `src/app/sitemap.ts` (modify — add release URLs)
- `src/messages/en.json`, `src/messages/ja.json`, `src/messages/mn.json`
  (modify — add ONE key: `musicPage.tracklist`)
- `src/app/globals.css` (append styles)

**Out of scope** (do NOT touch):
- `src/content/site.ts` — `releases` stays exactly as-is; new data lives in
  the new module.
- Audio playback — separate plan (plans/004).
- The projects-page filter nav — not this plan.
- NOTE: `src/app/[lang]/music/page.tsx` is ALSO modified by plans/007 — if
  executing both, land this plan first.

## Git workflow

- Branch: `advisor/001-release-detail-pages`
- Commit per step; message style: short imperative lowercase, e.g.
  `add release-details content module` (repo has one commit; keep messages minimal).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the per-release content module

Create `src/content/release-details.ts`:

```ts
export type ReleaseTrack = { number: string; title: string; duration: string };

export type ReleaseLyrics = {
  title: string;
  sections: { heading?: string; lines: string[] }[];
};

export type ReleaseDetail = {
  description: string;
  tracks?: ReleaseTrack[];
  lyrics?: ReleaseLyrics;
};

export const releaseDetails: Record<string, ReleaseDetail> = {
  "transparent-city-and-rain": {
    description: "A pale, transparent ballad about rain, memory, and the city that keeps both.",
    tracks: [
      { number: "01", title: "透明な街と雨", duration: "3:48" },
      { number: "02", title: "傘の忘れ物", duration: "3:36" },
      { number: "03", title: "さよならの温度", duration: "3:31" },
      { number: "04", title: "アスファルトの記憶", duration: "3:37" },
    ],
  },
};
```

Then add entries for the remaining five slugs with a one-sentence English
`description` derived from the release's `englishTitle` in
`src/content/site.ts` and **no** `tracks`/`lyrics` keys yet. These
descriptions are maintainer-editable placeholder copy — do not invent
tracklists or lyrics.

**Verify**: `npx tsc --noEmit 2>&1 | head -5` → if it reports errors about
missing `.next/types`, run `npm run build` first, then re-run; ultimately exit 0.

### Step 2: Create the detail route

Create `src/app/[lang]/music/[slug]/page.tsx`, modeled structurally on
`src/app/[lang]/journal/[slug]/page.tsx`:

- `generateStaticParams()` returns
  `locales.flatMap((lang) => releases.map(({ slug }) => ({ lang, slug })))`;
  `export const dynamicParams = false;`
- `generateMetadata` returns
  `{ title: \`${release.title} — kotakunp\`, description: releaseDetails[slug]?.description ?? release.englishTitle }`.
  (`releases` in `site.ts` has NO `description` field — read it from
  `releaseDetails`, falling back to `englishTitle`.)
- Page body: resolve `lang` + `slug` from awaited params; `notFound()` unless
  `isLocale(lang)` and the slug exists in `releases`; render:

```tsx
<main id="top">
  <SiteHeader locale={lang} active="music" labels={copy.nav} />
  <article className="release-detail page-width">
    <div className="release-detail-grid">
      <div className="featured-cover">
        <Image src={release.cover} alt={`Cover art for ${release.englishTitle}`} fill sizes="(max-width: 760px) 100vw, 320px" priority />
      </div>
      <div className="featured-copy">
        <span className="tag">{release.type}</span>
        <h1>{release.title}</h1>
        <p>{release.englishTitle}</p>
        <p>{release.date} | {release.tracks} tracks | {release.duration}</p>
        <p>{detail?.description}</p>
      </div>
    </div>
    {detail?.tracks ? (
      <section className="release-section">
        <h2 className="section-title">{copy.musicPage.tracklist}</h2>
        <div className="track-list">
          {detail.tracks.map((track) => (
            <div key={track.number}><span>{track.number}</span><b>{track.title}</b><time>{track.duration}</time></div>
          ))}
        </div>
      </section>
    ) : null}
    {detail?.lyrics ? (
      <section className="release-section" id="lyrics">
        <h2 className="section-title">{copy.musicPage.lyrics}</h2>
        {detail.lyrics.sections.map((section, i) => (
          <div className="lyrics-block" key={i}>
            {section.heading ? <h3>{section.heading}</h3> : null}
            {section.lines.map((line, j) => <p key={j}>{line}</p>)}
          </div>
        ))}
      </section>
    ) : null}
    <Link className="text-link" href={`/${lang}/music`}>{copy.musicPage.discography} →</Link>
  </article>
  <SiteFooter locale={lang} labels={copy.nav} />
</main>
```

Reuse existing dictionary keys for chrome (`copy.musicPage.lyrics`), and add
ONE new key — `musicPage.tracklist` — to all three locale files (inside the
existing `"musicPage"` object, keeping key order consistent):

- `en.json`: `"tracklist": "tracklist"`
- `ja.json`: `"tracklist": "トラックリスト"`
- `mn.json`: `"tracklist": "дууны жагсаалт"`

(Do NOT reuse `musicPage.discography` for the tracklist heading — it means
"discography", not "tracklist".)

Append to `src/app/globals.css` (match the existing dense one-line style):

```css
.release-detail{padding:38px 0 58px}.release-detail h1{margin:8px 0 4px;font-size:clamp(34px,4vw,52px)}.release-detail-grid{display:grid;grid-template-columns:300px 1fr;gap:40px;align-items:center;padding-bottom:34px;border-bottom:1px solid var(--rule)}.release-detail .featured-copy p{margin:4px 0;color:var(--muted);font-size:13px}.release-detail .featured-copy .tag{margin-bottom:6px}.release-section{margin-top:40px}.release-section>.section-title{margin-bottom:16px}.lyrics-block{max-width:560px;margin-top:26px}.lyrics-block h3{margin:0 0 10px;font-size:13px;font-weight:500;color:var(--muted)}.lyrics-block p{margin:0;font-size:15px;line-height:2}
@media (max-width:720px){.release-detail-grid{grid-template-columns:1fr}}
```

**Verify**: `npm run build` → exit 0; output lists `/en/music/transparent-city-and-rain`
(and 17 sibling paths) under `[lang]/music/[slug]`.

### Step 3: Wire ReleaseCard links

Modify `src/components/release-card.tsx`:

- Add imports: `Link` from `next/link`, `releaseDetails` from
  `@/content/release-details`.
- Add required prop `locale: string`.
- Compute `const detail = releaseDetails[release.slug];`
- Replace the `card-actions` line so both actions are links to the detail
  page ("lyrics" deep-links to the lyrics anchor only when lyrics exist):

```tsx
<div className="card-actions">
  <Link href={`/${locale}/music/${release.slug}`}>listen →</Link>
  {detailed && detail?.lyrics ? <Link href={`/${locale}/music/${release.slug}#lyrics`}>lyrics →</Link> : detailed ? <span>lyrics →</span> : <Play className="play-icon" aria-label="Play" size={14} fill="currentColor" />}
</div>
```

Update both callers to pass `locale={lang}`:
- `src/app/[lang]/page.tsx:39` (`<ReleaseCard key={release.slug} release={release} locale={lang} />`)
- `src/app/[lang]/music/page.tsx:34` (same pattern, `detailed` kept).

Honesty note: only releases with seeded lyrics get an active "lyrics →" link;
the rest keep a `<span>` until the maintainer seeds lyrics. "listen →" is
active for ALL releases.

### Step 3b: Wire the featured-release block on the music page

The hero block at `src/app/[lang]/music/page.tsx:28` also has dead spans:

```tsx
<div className="inline-links"><span>{copy.musicPage.listen} →</span><span>{copy.musicPage.lyrics} →</span></div>
```

Replace with links to the latest release's detail page (`latest` is already
resolved as `releases[0]` on line 17):

```tsx
const latestDetail = releaseDetails[latest.slug];
...
<div className="inline-links"><Link href={`/${lang}/music/${latest.slug}`}>{copy.musicPage.listen} →</Link>{latestDetail?.lyrics ? <Link href={`/${lang}/music/${latest.slug}#lyrics`}>{copy.musicPage.lyrics} →</Link> : <span>{copy.musicPage.lyrics} →</span>}</div>
```

Add the `releaseDetails` import alongside the existing ones.

**Verify**: `npm run lint` → exit 0 (catches missing props via TS-aware rules);
then `npm run build` → exit 0.

### Step 4: Functional discography filter

Create `src/components/discography-filter.tsx` as a client component that
owns the filter state and renders nav + grid:

```tsx
"use client";

import { useState } from "react";
import { ReleaseCard } from "./release-card";
import type { releases } from "@/content/site";

type Release = (typeof releases)[number];
const types = ["all", "single", "ep", "album", "ost"] as const;

export function DiscographyFilter({ releases, locale }: { releases: readonly Release[]; locale: string }) {
  const [active, setActive] = useState<(typeof types)[number]>("all");
  const visible = active === "all" ? releases : releases.filter((r) => r.type === active);
  return (
    <>
      <nav className="filter-nav" aria-label="Filter by type">
        {types.map((type) => (
          <button key={type} type="button" className={active === type ? "active" : ""} onClick={() => setActive(type)} disabled={type === "album"}>
            {type}
          </button>
        ))}
      </nav>
      <div className="release-grid discography-grid">
        {visible.map((release) => <ReleaseCard key={release.slug} release={release} detailed locale={locale} />)}
      </div>
    </>
  );
}
```

Note: no release has `type: "album"` today, hence `disabled` on that option —
keeps the nav honest without an empty grid.

In `src/app/[lang]/music/page.tsx`, the discography section currently nests
the filter nav INSIDE the `.section-head` flex row (title left, "newest ▾"
right). The new structure keeps `.section-head` as-is (heading + newest span
only) and renders the component BELOW it as a sibling — the component owns
both the nav and the grid:

```tsx
<section className="discography page-width" id="discography">
  <div className="section-head"><div><h2 className="section-title">{copy.musicPage.discography}</h2></div><span>{copy.musicPage.newest} ▾</span></div>
  <DiscographyFilter releases={releases} locale={lang} />
</section>
```

Do NOT place `<DiscographyFilter>` inside `.section-head` — it renders the
grid too, and the flex row would break the layout. The old inline
`filter-nav` nav and `discography-grid` div are both deleted from the page
(they now live inside the component).

Append CSS (buttons currently inherit browser styles):

```css
.filter-nav button{padding:0;border:0;background:none;color:inherit;cursor:pointer;font-size:12px;position:relative}.filter-nav button:disabled{opacity:.38;cursor:default}.filter-nav button.active:after{position:absolute;right:-10px;bottom:-8px;left:-10px;height:1px;content:"";background:var(--ink)}
```

(The existing rule `.filter-nav .active:after` targets spans; the button
selector above supersedes it for the music page.)

**Verify**: `npm run build` → exit 0. Manual: `npm run dev`, open
`http://localhost:3000/en/music`, click `ep` → only the two EP cards remain;
click `all` → six cards.

### Step 5: Add release URLs to the sitemap

`src/app/sitemap.ts` currently lists only the six static pages. Extend it so
each locale also gets its six release URLs:

```ts
import { releases } from "@/content/site";

// inside the flatMap, after the pages map:
const releaseUrls = releases.map(({ slug }) => ({
  url: `${baseUrl}/${locale}/music/${slug}`,
  lastModified: new Date(),
  changeFrequency: "monthly" as const,
  priority: 0.6,
}));
return [...pagesUrls, ...releaseUrls];
```

(Adapt to the existing structure — the requirement is: for each of the three
locales, emit `/en/music/<slug>`-style entries for all six slugs with
`priority: 0.6`.)

**Verify**: `npm run build` → exit 0; then `curl -s localhost:3000/sitemap.xml | grep -c "/music/"` → 18 (dev server).

### Step 6: Final gates

**Verify**: `npm run lint` → exit 0; `npm run build` → exit 0;
`git status --short` shows only in-scope files modified/created.

## Test plan

No test framework exists (verification is lint + build + manual browser pass,
per repo convention). Manual checklist:
- `/en/music/transparent-city-and-rain` shows cover, tag, title, meta line,
  description, 4-row tracklist, back link.
- `/en/music/grey-morning` shows description but no tracklist/lyrics sections.
- `/ja/music/transparent-city-and-rain` renders header/footer in Japanese.
- `/en/music/not-a-real-slug` returns 404.
- Card "listen →" navigates to the detail page from home and music pages.

## Done criteria

- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0 and lists 18 prerendered `/[lang]/music/[slug]` paths
- [ ] `curl -s localhost:3000/en/music/transparent-city-and-rain | grep -c "アスファルトの記憶"` → 1 (dev server)
- [ ] `curl -s localhost:3000/sitemap.xml | grep -c "/music/"` → 18
- [ ] No `<span>listen →</span>` remains in `release-card.tsx`: the "listen" action is a `Link`
- [ ] All three message JSON files contain `musicPage.tracklist`
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `src/content/site.ts` slugs no longer match the six listed in Current state.
- `PageProps<"/[lang]/music/[slug]">` is not recognized by the compiler even
  after a fresh `npm run build` (typed-routes generation changed).
- The journal `[slug]` exemplar no longer matches the excerpt above (routing
  conventions drifted).
- Any step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- New releases require three edits: the `releases` array in `site.ts`, a
  matching key in `release-details.ts` (description at minimum), and nothing
  else (sitemap + OG pick up automatically). A reviewer should reject PRs
  that add one without the other.
- Tracklists/lyrics/descriptions are maintainer-supplied content; the seeded
  descriptions are placeholders derived from `englishTitle`. Until lyrics are
  seeded, "lyrics →" stays an inert span on cards and the featured block —
  that is by design, not a bug.
- When a release with `type: "album"` ships, remove the `disabled` from the
  album filter button in `discography-filter.tsx`.
- plans/004 (audio previews) extends `ReleaseDetail` with a `preview` field
  and renders a player on these pages; plans/006 adds an
  `opengraph-image.tsx` beside this route. Keep the route's
  `generateStaticParams` the single source of slug enumeration for both.
- `src/app/[lang]/music/page.tsx` is also modified by plans/007 — coordinate.
