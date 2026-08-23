# Plan 008: Convert image assets to WebP and add a Japanese font

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6bc950a..HEAD -- public src/content src/app/[lang]/layout.tsx src/components/hero-visual.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition — EXCEPT layout.tsx OG-image line
> removals from plans/006 (expected; see Step 2's conditional note).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED (touches every image reference; font download needs network)
- **Depends on**: none hard; README orders it after 005+006 (shared
  `layout.tsx`) — Step 2 tolerates either order
- **Category**: perf
- **Planned at**: commit `6bc950a`, 2026-08-21

## Why this matters

The repo ships ~12MB of PNGs: four covers at ~2.2–2.5MB each plus two hero
images, all served to visitors (Next optimizes at request time, but the
sources bloat the repo and deploys, and OG images reference the raw PNG).
Converting to WebP cuts these by roughly 80–90%. Separately, Japanese release
and track titles render in system fallback fonts because Geist has no JP
glyphs; adding a pre-subset Noto Sans JP via `next/font` makes ja typography
intentional instead of accidental.

## Current state

- Assets (`du -sh` verified):
  ```
  8.9M   public/covers   (glass-flowers.png, railway-dawn.png, rain-city.png, white-field.png)
  2.2M   public/hero.png          ← UNREFERENCED anywhere in src/ (dead asset)
  1.1M   public/hero-clean.png    ← referenced twice (below)
  ```
- References to update after conversion:
  - `src/content/site.ts` — `cover:` fields use `/covers/*.png` (4 distinct paths,
    some reused across releases).
  - `src/content/posts/*.mdx` — `cover:` in each post's exported metadata
    (3 files).
  - `src/components/hero-visual.tsx:11` — `<Image src="/hero-clean.png" ...>`
  - `src/app/[lang]/layout.tsx:38,44` — OG/Twitter images `/hero-clean.png`.
- `sharp` is present in `node_modules` (bundled with next) — importable from
  a plain Node script without adding a dependency.
- Fonts (`src/app/[lang]/layout.tsx:7-15`): Geist + Geist_Mono via
  `next/font/google`, exposed as CSS variables `--font-geist` /
  `--font-geist-mono`. The mono stack is defined in `globals.css:3`:
  ```css
  --mono:var(--font-geist-mono),"SFMono-Regular","Hiragino Kaku Gothic ProN","Yu Gothic",monospace;
  ```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint    | `npm run lint`  | exit 0 |
| Build   | `npm run build` | exit 0 (also downloads Google fonts — needs network) |
| Convert | `node scripts/optimize-images.mjs` | writes .webp files, prints size table |

## Scope

**In scope**:
- `scripts/optimize-images.mjs` (create)
- `public/covers/*.webp`, `public/hero-clean.webp` (create, via script)
- `public/hero.png` (DELETE — unreferenced dead asset)
- `public/covers/*.png`, `public/hero-clean.png` (DELETE after refs updated)
- `src/content/site.ts`, `src/content/posts/*.mdx`,
  `src/components/hero-visual.tsx`, `src/app/[lang]/layout.tsx` (reference updates only)
- `src/app/[lang]/layout.tsx` (add Noto_Sans_JP; png→webp on OG image lines
  ONLY if plans/006 has not already removed them — see Step 2),
  `src/app/globals.css` (mono stack INSERTION after Geist Mono — never
  before/prepend, see Step 3)

**Out of scope**:
- `src/app/icon.svg` (vector; leave as-is).
- AVIF variants (WebP is the agreed target; AVIF encode time isn't worth it here).
- Any layout/style changes beyond the font variable.

## Git workflow

- Branch: `advisor/008-assets-and-font`
- Commit per step; short imperative lowercase messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Conversion script

Create `scripts/optimize-images.mjs`. The file list is explicit — convert
the four covers plus `hero-clean.png`, nothing else (`hero.png` is dead and
gets deleted in Step 2):

```js
import sharp from "sharp";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const files = [
  ...readdirSync("public/covers").filter((n) => n.endsWith(".png")).map((n) => path.join("public/covers", n)),
  "public/hero-clean.png",
];

for (const input of files) {
  const output = input.replace(/\.png$/, ".webp");
  const info = await sharp(input).webp({ quality: 82 }).toFile(output);
  console.log(`${input} -> ${output}  ${(statSync(input).size / 1e6).toFixed(2)}MB -> ${(info.size / 1e6).toFixed(2)}MB`);
}
```

Run it: `node scripts/optimize-images.mjs`.

`sharp` resolves here as Next's transitive dependency. If the import fails
in your environment, run `npm install -D sharp` (adding the devDependency is
the sanctioned fix) — do NOT substitute a different image library or a
hand-rolled encoder.

**Verify**: `ls public/covers/*.webp public/*.webp` shows 5 webp files; the
printed table shows ~5–10× reductions. Do NOT delete PNGs yet.

### Step 2: Update every reference

Replace `.png` → `.webp` in exactly these locations:

- `src/content/site.ts`: all four `cover: "/covers/<name>.png"` values.
- `src/content/posts/building-a-small-listening-room.mdx`,
  `notes-before-the-voice.mdx`, `transparent-city-and-rain.mdx`: the `cover:`
  value in each exported `metadata`.
- `src/components/hero-visual.tsx:11`: `src="/hero-clean.png"` → `"/hero-clean.webp"`.
- `src/app/[lang]/layout.tsx:38` and `:44`: `"/hero-clean.png"` →
  `"/hero-clean.webp"` (keep the explicit `width: 1536, height: 1024` on
  line 38). **Conditional**: if those lines no longer reference
  `/hero-clean.png` — plans/006 landed first and deleted them — SKIP these
  two rewrites; that is the expected post-006 state, not drift. Do not
  recreate the entries.

Then delete the originals and the dead asset:

```sh
rm public/covers/glass-flowers.png public/covers/railway-dawn.png public/covers/rain-city.png public/covers/white-field.png public/hero-clean.png public/hero.png
```

**Verify**: `grep -rn "\.png" src/ | grep -v icon.svg` → no matches;
`npm run build` → exit 0.

### Step 3: Japanese font

In `src/app/[lang]/layout.tsx`, add alongside the existing fonts:

```ts
import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google";

const notoSansJp = Noto_Sans_JP({
  weight: ["400", "500"],
  variable: "--font-jp",
  preload: false,
});
```

Do NOT pass `subsets`. The `Noto_Sans_JP` type only allows
`'cyrillic' | 'latin' | 'latin-ext' | 'vietnamese'` — there is no
`"japanese"` subset (CJK coverage is implicit in the font), so passing one
fails typecheck. With `preload: false` no subset needs to be declared.

Add `notoSansJp.variable` to the `<html>` className template string next to
the other two variables. `preload: false` matters: the full JP font is large
and would otherwise be preloaded on every page.

In `src/app/globals.css:3`, insert the variable into the mono stack AFTER
`var(--font-geist-mono)` — NOT before it. Noto Sans JP contains latin glyphs,
so placing it first would change the rendering of ALL Latin text. Appending
it after Geist Mono means it serves only the Japanese glyphs Geist lacks:

```css
--mono:var(--font-geist-mono),var(--font-jp),"SFMono-Regular","Hiragino Kaku Gothic ProN","Yu Gothic",monospace;
```

**Verify**: `npm run build` → exit 0 (requires network for the font fetch).

### Step 4: Final gates

```sh
npm run lint                 # expect exit 0
npm run build                # expect exit 0
du -sh public                # expect well under 2MB (was ~12MB)
grep -rn "\.png" src/ | grep -v icon.svg   # expect no matches
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/covers/rain-city.webp  # dev server: expect 200
```

Manual browser pass: covers render on `/en/music` and journal cards; Japanese
titles (e.g. 透明な街と雨) render in Noto Sans JP rather than Hiragino system
fallback (compare letterforms, or check DevTools computed font).

## Test plan

No test framework exists. Step 4's command matrix plus manual visual pass is
the test plan. Critical regression to watch: any missed `.png` reference
would 404 an image — the grep gate catches references in `src/`; the build
catches broken imports.

## Done criteria

- [ ] `npm run lint` exits 0; `npm run build` exits 0
- [ ] `grep -rn "\.png" src/ | grep -v icon.svg` returns nothing
- [ ] `public/` contains no `.png` files; total size < 2MB
- [ ] `grep -n "Noto_Sans_JP" src/app/[lang]/layout.tsx` → present, with `preload: false` and NO `subsets` key
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The build machine has no network access (Google Fonts fetch fails) — report;
  do not self-host font files as an improvised workaround.
- `import sharp from "sharp"` fails AND `npm install -D sharp` also fails —
  report; do not substitute a different image library.
- WebP conversion of any cover fails or produces a file LARGER than the PNG —
  keep that PNG and report which one.
- Any page visually breaks in the manual pass (image aspect/positioning) —
  revert the affected reference and report.
- Any step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Future art assets should arrive as high-quality sources and be converted
  via `scripts/optimize-images.mjs`; the script's file list is explicit —
  extend the `files` array when new asset classes appear.
- If OG images (plans/006) later embed cover bitmaps, they read the `.webp`
  files — satori handles webp via `data:` URLs but verify at that time.
- Reviewers should confirm the font stack order edit kept Geist Mono BEFORE
  `--font-jp` (latin rendering must not change), and that no `subsets` key
  was added to the Noto_Sans_JP call.
