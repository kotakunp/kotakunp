# Plan 009: Fix global 404 for single-segment unknown paths

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6bc950a..HEAD -- "src/app/[lang]/layout.tsx" src/app/global-not-found.tsx next.config.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. NOTE: HEAD is still `6bc950a` — the
> entire site lives as uncommitted working-tree changes; verify excerpts
> against the working tree.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/003 (must be landed first — its files are in the tree)
- **Category**: bug
- **Planned at**: commit `6bc950a`, 2026-08-21

## Why this matters

Plan 003 left one gap BLOCKED: `/xyz` (unknown single-segment path) serves
Next's generic error shell instead of the custom global 404. Root cause is
NOT a framework defect — Next 16.3.0/16.3.1 render `global-not-found.tsx`
correctly for true routing no-matches (verified: `/xyz/foo` and `/foo/bar`
serve the custom page). The gap: `/xyz` **syntactically matches** the
top-level `[lang]` dynamic segment, so routing enters `[lang]`, the layout
throws `notFound()` for the invalid locale, and no not-found boundary exists
above `[lang]` to catch it. Removing the layout-level throw turns `/xyz`
into a true no-match, letting the routing-level global 404 fire as designed.
Every page under `[lang]` already guards itself, so nothing loses protection.

## Current state

- `src/app/[lang]/layout.tsx:55-67` — the layout renders ONLY `<html>`/
  `<body>` (header/footer live in each page, not here):
  ```tsx
  export default async function LocaleLayout({ children, params }: LayoutProps<"/[lang]">) {
    const { lang } = await params;
    if (!isLocale(lang)) notFound();   // ← line 60, THE BUG
    return (
      <html lang={lang} className={`${geist.variable} ${geistMono.variable} ${notoSansJp.variable}`} suppressHydrationWarning>
        <body suppressHydrationWarning>{children}</body>
      </html>
    );
  }
  ```
  Line 3 imports `notFound` from `next/navigation` solely for line 60.
- `generateMetadata` in the same file (line 31) already handles invalid
  locales safely (`if (!isLocale(lang)) return {};`) — leave it untouched.
- ALL eight pages guard themselves with `isLocale` + `notFound()` (verified:
  home :14, about :11, music, music/[slug] :31, projects, journal,
  journal/[slug], contact). Removing the layout guard protects nothing less.
- `src/app/global-not-found.tsx` + `experimental.globalNotFound: true`
  (plan 003) exist and WORK for true no-matches — verified empirically on
  the production server: `/xyz/foo` and `/foo/bar` return 404 with the
  trilingual custom copy; `/_not-found` serves it too.
- `src/app/[lang]/not-found.tsx` (plan 003) catches page-level `notFound()`
  throws inside `[lang]` — e.g. `/xyz/about` will hit about's own guard and
  render this in-layout 404.

Expected behavior after this plan:

| URL | Result |
|---|---|
| `/xyz` | standalone global 404 (`global-not-found.tsx`), HTTP 404 |
| `/foo/bar` | standalone global 404 (unchanged, already works) |
| `/en/not-a-real-page` | in-layout `[lang]` 404 (unchanged) |
| `/xyz/about` | in-layout `[lang]` 404 (about's guard throws) |
| `/en`, `/ja/music`, … | normal pages, unchanged |

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint    | `npm run lint`  | exit 0 |
| Build   | `npm run build` | exit 0 |
| Prod server | `npx next start` after build | serves on :3000 |

Use a PRODUCTION server for verification (`next start`), not dev — dev-mode
error rendering differs. Free port 3000 first:
`lsof -t -iTCP:3000 -sTCP:LISTEN | xargs kill`.

## Scope

**In scope**:
- `src/app/[lang]/layout.tsx` (modify — remove two lines)

**Out of scope** (do NOT touch):
- Every page file — their self-guards are load-bearing after this change.
- `src/app/global-not-found.tsx`, `next.config.ts` — working as intended.
- `src/app/[lang]/not-found.tsx` — unchanged.
- `dictionaries.ts` — `isLocale` stays exported (pages use it).

## Git workflow

- Branch: `advisor/009-fix-global-404`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove the layout-level locale throw

In `src/app/[lang]/layout.tsx`:

1. Delete line 60: `if (!isLocale(lang)) notFound();`
2. Delete the now-unused import on line 3:
   `import { notFound } from "next/navigation";`

The layout body becomes:

```tsx
export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;

  return (
    <html lang={lang} className={`${geist.variable} ${geistMono.variable} ${notoSansJp.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
```

(`isLocale` remains imported — `generateMetadata` line 31 still uses it.)

**Verify**: `npm run lint` → exit 0 (an unused-import warning would mean
step 2 was missed); `npm run build` → exit 0.

### Step 2: Runtime verification matrix

Build, start the production server on freed port 3000, then run:

```sh
echo "/xyz       -> $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/xyz) custom=$(curl -s http://localhost:3000/xyz | grep -c 'Хуудас олдсонгүй')"
echo "/foo/bar   -> $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/foo/bar) custom=$(curl -s http://localhost:3000/foo/bar | grep -c 'Хуудас олдсонгүй')"
echo "/en/bad    -> $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/en/not-a-real-page) custom=$(curl -s http://localhost:3000/en/not-a-real-page | grep -c 'ページが見つかりません')"
echo "/xyz/about -> $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/xyz/about) custom=$(curl -s http://localhost:3000/xyz/about | grep -c 'ページが見つかりません')"
echo "/en        -> $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/en)"
echo "/ja/music  -> $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ja/music)"
```

Expected:

```
/xyz       -> 404 custom=1
/foo/bar   -> 404 custom=1
/en/bad    -> 404 custom=1
/xyz/about -> 404 custom=1
/en        -> 200
/ja/music  -> 200
```

Kill the server afterwards.

## Test plan

No test framework exists. Step 2's six-case matrix IS the test plan — it
covers both global-404 paths (single- and multi-segment), both in-layout 404
paths (valid-locale unknown page, invalid-locale known page), and normal-page
regression checks across two locales.

## Done criteria

- [ ] `npm run lint` exits 0 with zero warnings; `npm run build` exits 0
- [ ] All six curl expectations in Step 2 hold exactly
- [ ] `grep -c "notFound" "src/app/[lang]/layout.tsx"` → 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- After Step 1, `/xyz` still returns the generic shell (custom=0) on the
  production server — report; do NOT add middleware or other machinery
  without operator approval.
- Any normal page regresses (non-404 URL returning 404, or 500s) — revert
  Step 1 and report.
- Any step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The layout now renders for ANY `[lang]` value syntactically matched by a
  deeper route (e.g. `/xyz/about` briefly renders `<html lang="xyz">` before
  about's guard throws and the boundary swaps in the 404). Harmless — the
  final response is the 404 document — but reviewers should know the layout
  no longer guarantees a valid locale; NEVER rely on `lang` being valid in
  this layout.
- New pages added under `[lang]` MUST keep their own `isLocale`+`notFound()`
  guard — it is the only protection now. A reviewer should reject new pages
  without it.
- If a future Next version stabilizes `globalNotFound` with different
  routing semantics, re-test the matrix in Step 2.
