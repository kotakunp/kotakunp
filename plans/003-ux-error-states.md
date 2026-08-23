# Plan 003: Error, not-found, and loading states + honest pending affordances

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6bc950a..HEAD -- src/app next.config.ts src/app/globals.css`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (touches routing config)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `6bc950a`, 2026-08-21

## Why this matters

The app has no `not-found`, `error`, or `loading` boundaries: runtime errors
show Next's default crash screen, unknown URLs show the unstyled default 404,
and locale-less URLs (`/xyz`) fall through to it too because the only layout
lives under `[lang]`. Separately, several controls look clickable but do
nothing (projects filter nav, case-study link), which erodes trust in the
controls that DO work. This plan adds branded error/404/loading states and
marks permanently-inert controls with the same "pending" treatment the social
icons already use.

## Current state

- The ONLY layout is `src/app/[lang]/layout.tsx` (renders `<html>`/`<body>`).
  There is no root `src/app/layout.tsx`. This is the documented use case for
  Next's experimental `global-not-found`: per the bundled docs
  (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`,
  section "`global-not-found.js` (experimental)"): *"Your root layout is
  defined using top-level dynamic segments (e.g. `app/[country]/layout.tsx`),
  which makes composing a consistent 404 page harder."* Enabling it requires
  a config flag and an `app/global-not-found.tsx` that renders its own
  `<html>`/`<body>` and imports global styles itself.
- `next.config.ts` today:
  ```ts
  // next.config.ts:4-16
  const nextConfig: NextConfig = {
    reactCompiler: true,
    pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
    async redirects() { return [{ source: "/", destination: "/en", permanent: false }]; },
  };
  ```
- Design tokens live at the top of `src/app/globals.css:3`:
  `--paper:#f8f7f3; --ink:#17191a; --muted:#626561; --rule:#d9d7d1;`
  Body font is `var(--mono)` at 15px. Existing "pending" treatment:
  `.social-pending{opacity:.38}` (`globals.css:10`) with hover restore.
- Dead controls to mark:
  - `src/app/[lang]/projects/page.tsx:16` — `<span>{copy.projectsPage.caseStudy} →</span>`
    inside `.featured-project-links`.
  - `src/app/[lang]/projects/page.tsx:18` — `.filter-nav` spans (only
    `all` has `.active`; none are interactive).
- `src/components/site-header.tsx` / `site-footer.tsx` show the header/footer
  pattern (locale-aware links); NOT-found pages inside `[lang]` can reuse them.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint    | `npm run lint`  | exit 0 |
| Build   | `npm run build` | exit 0 |
| Dev server | `npm run dev` | serves on :3000 |

## Scope

**In scope**:
- `next.config.ts` (add one flag)
- `src/app/global-not-found.tsx` (create)
- `src/app/[lang]/not-found.tsx` (create)
- `src/app/[lang]/error.tsx` (create)
- `src/app/[lang]/loading.tsx` (create)
- `src/app/[lang]/projects/page.tsx` (modify — pending markers only)
- `src/app/globals.css` (append styles)

**Out of scope**:
- Restructuring layouts (no root layout creation; `global-not-found` exists
  precisely to avoid that).
- The music-page filter nav and newsletter fake input (plans/001 and /007 own those).
- Any change to dictionary JSON files (these states are language-neutral by design).

## Git workflow

- Branch: `advisor/003-ux-error-states`
- Commit per step; short imperative lowercase messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Locale-aware not-found inside [lang]

Create `src/app/[lang]/not-found.tsx`. It renders INSIDE the `[lang]` layout
(so no `<html>`/`<body>`). It receives no params, so keep copy
language-neutral and OMIT the header/footer — a hardcoded-locale footer would
link a Japanese visitor into `/en/...`:

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main id="top">
      <section className="nf-hero page-width">
        <h1>404</h1>
        <p>This page does not exist — ページが見つかりません — Хуудас олдсонгүй.</p>
        <Link className="text-link" href="/en">kotakunp →</Link>
      </section>
    </main>
  );
}
```

Append CSS:

```css
.nf-hero{display:flex;flex-direction:column;gap:14px;align-items:flex-start;justify-content:center;min-height:46vh}.nf-hero h1{font-size:clamp(72px,9vw,120px)}
```

**Verify**: `npm run build` → exit 0.

### Step 2: Global not-found for unmatched routes

Enable the flag in `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: { globalNotFound: true },
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  ...
```

Create `src/app/global-not-found.tsx` (self-contained; bypasses all layouts,
so it must render its own html/body and import styles itself — note it sits
in `src/app/` NEXT TO `globals.css`, so the import is `./globals.css`):

```tsx
import "./globals.css";

export const metadata = { title: "404 — kotakunp" };

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body style={{ background: "#f8f7f3", color: "#17191a" }}>
        <main className="page-width nf-hero" style={{ minHeight: "100vh" }}>
          <h1>404</h1>
          <p>This page does not exist — ページが見つかりません — Хуудас олдсонгүй.</p>
          <a className="text-link" href="/en">kotakunp →</a>
        </main>
      </body>
    </html>
  );
}
```

(The inline background/color guards against a flash of unstyled content since
Google fonts are not loaded here; `globals.css` supplies everything else.)

**Verify**: `npm run build` → exit 0 (if the build errors on the experimental
flag name, STOP — see conditions).

### Step 3: Error boundary and loading state

Create `src/app/[lang]/error.tsx`. In this Next version the error-boundary
prop is `retry()` (re-fetches and re-renders) — `reset()` also exists but
only re-renders without refetching; the docs recommend `retry`:

```tsx
"use client";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="page-width nf-hero">
      <h1>—</h1>
      <p>Something went wrong. Try again.</p>
      <button type="button" className="text-link retry-button" onClick={() => retry()}>retry →</button>
    </main>
  );
}
```

Create `src/app/[lang]/loading.tsx`:

```tsx
export default function Loading() {
  return <div className="route-loading" aria-busy="true">···</div>;
}
```

Append CSS:

```css
.retry-button{align-self:flex-start;padding:0;border:0;border-bottom:1px solid var(--ink);background:none;color:inherit;cursor:pointer;font-size:13px}.route-loading{display:grid;min-height:50vh;place-items:center;color:var(--faint);font-size:20px}
```

Note: `error.tsx` must not render header/footer (the layout may itself be the
failure point); keeping it bare is intentional.

**Verify**: `npm run lint` → exit 0; `npm run build` → exit 0.

### Step 4: Mark inert controls as pending

In `src/app/[lang]/projects/page.tsx`:

- Line 16: give the case-study span the pending treatment:
  `<span className="pending">{copy.projectsPage.caseStudy} →</span>`
- Line 18: add `className="pending"` to every non-active filter span
  (keep `.active` on `all`).

Append CSS reusing the established opacity convention:

```css
.pending{opacity:.38}
```

**Verify**: `git diff --stat` shows only in-scope files; `npm run build` → exit 0.

### Step 5: Runtime verification

Start `npm run dev`, then:

```sh
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/en/not-a-real-page   # expect 404
curl -s http://localhost:3000/en/not-a-real-page | grep -c "ページが見つかりません"     # expect 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/xyz                  # expect 404
curl -s http://localhost:3000/xyz | grep -c "Хуудас олдсонгүй"                      # expect 1
```

Manual browser pass: `/en/xyz` shows the styled in-layout 404 (no footer —
intentional); `/xyz` shows the standalone global 404 on the paper background.
If `/xyz` renders the IN-LAYOUT 404 instead of the standalone one,
`global-not-found.tsx` is not being picked up — treat as a STOP condition.

## Test plan

No test framework exists; the curl matrix in Step 5 plus the manual browser
pass is the test plan. Cover: unknown path under valid locale, unknown locale
at root, and visual confirmation of pending-opacity controls on `/en/projects`.

## Done criteria

- [ ] `npm run lint` exits 0; `npm run build` exits 0
- [ ] Both curl 404 checks return custom markup (grep counts = 1)
- [ ] `grep -n "globalNotFound" next.config.ts` → 1 match
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The build rejects `experimental.globalNotFound` (flag renamed/removed in
  this Next version) — report; do not substitute a root layout restructure
  without operator approval.
- Any step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If a root layout is ever introduced, `global-not-found.tsx` can be demoted
  to a normal root `not-found.tsx`; revisit then.
- The trilingual one-line 404 copy is deliberate (boundaries receive no
  locale); if dictionaries ever expose a locale-aware boundary API, replace it.
- Reviewers should confirm the projects filter spans got opacity-only changes
  — no new interactivity was smuggled in.
