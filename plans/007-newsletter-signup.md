# Plan 007: Real newsletter signup on the music page

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6bc950a..HEAD -- src/app/[lang]/music/page.tsx src/app/api src/messages src/lib/rate-limit.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition — EXCEPT changes listed as expected
> in the STOP conditions section (plans/001's tracklist key and music-page
> links). This plan REQUIRES plan 002 to be DONE (the
> `src/lib/rate-limit.ts` module must exist).

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/002-message-wall-hardening.md (must be landed first — reuses its rate limiter; see `plans/README.md` for live status)
- **Category**: direction
- **Planned at**: commit `6bc950a`, 2026-08-21

## Why this matters

The music page's "stay in the loop" block renders a `.fake-input` div that
accepts nothing (`src/app/[lang]/music/page.tsx:36`). This plan replaces it
with a working signup form backed by a route handler that validates email,
rate-limits via the plan-002 module, stores subscribers locally (same NDJSON
pattern as the message wall), and optionally forwards to Buttondown when an
API key is configured.

## Current state

- The CTA block:
  ```tsx
  // src/app/[lang]/music/page.tsx:36
  <section className="music-cta page-width"><div><h2>{copy.musicPage.stay}</h2><p>{copy.musicPage.updates}</p></div><div className="fake-input">{copy.musicPage.email}<span>→</span></div><div><h2>{copy.musicPage.work}</h2><p>{copy.musicPage.workNote}</p></div><Link href={`/${lang}/contact`}>{copy.nav.contact} →</Link></section>
  ```
- Existing dictionary keys (`src/messages/en.json:15`): `musicPage.stay`
  ("stay in the loop"), `musicPage.updates`, `musicPage.email`
  ("email address"). No success/error strings exist yet.
- Message-wall patterns to copy:
  - Honeypot field markup + `.honeypot` CSS (`src/components/reach-out.tsx:87-90`,
    `globals.css:16`).
  - Status state machine `"idle" | "sending" | "success" | "error"` with a
    `form-status` paragraph (`reach-out.tsx:28, 117-120`).
  - NDJSON append storage (`src/app/api/messages/route.ts:59`).
- `src/lib/rate-limit.ts` exports `rateLimit(key, limit, windowMs)` (from plan 002).
- Dictionaries are JSON files per locale: `src/messages/en.json`, `ja.json`,
  `mn.json` — all three must receive identical new keys.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint    | `npm run lint`  | exit 0 |
| Build   | `npm run build` | exit 0 |
| Dev server | `npm run dev` | serves on :3000 |

## Scope

**In scope**:
- `.gitignore` (modify — ignore subscriber data)
- `src/app/api/subscribe/route.ts` (create)
- `src/components/newsletter-form.tsx` (create)
- `src/app/[lang]/music/page.tsx` (modify — replace fake input; NOTE: also
  modified by plans/001 — land 001 first or expect textual conflicts)
- `src/messages/en.json`, `src/messages/ja.json`, `src/messages/mn.json` (modify — add keys)
- `src/app/globals.css` (append styles)

**Out of scope**:
- Double opt-in / confirmation emails (provider-side concern).
- Any UI outside the music-page CTA block.
- Changing the message wall.

## Git workflow

- Branch: `advisor/007-newsletter-signup`
- Commit per step; short imperative lowercase messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Gitignore subscriber data FIRST

`.gitignore` currently has no entry for `data/` — `data/reach-out.ndjson`
(message-wall content) is untracked but one careless `git add data` would
publish it, and this plan adds subscriber EMAILS to that directory. Add
before anything else:

```
# user data (message wall, newsletter subscribers)
/data/*.ndjson
```

**Verify**: `git status --short` no longer lists `data/`.

### Step 2: Dictionary keys (all three locales)

Add to each locale file inside the `"musicPage"` object:

- `en.json`: `"newsletterSend": "subscribe", "newsletterSuccess": "You're on the list. Thank you.", "newsletterError": "Could not subscribe. Try again.", "newsletterSending": "subscribing…"`
- `ja.json`: `"newsletterSend": "登録", "newsletterSuccess": "登録ありがとうございます。", "newsletterError": "登録できませんでした。もう一度お試しください。", "newsletterSending": "送信中…"`
- `mn.json`: `"newsletterSend": "бүртгүүлэх", "newsletterSuccess": "Бүртгүүлсэнд баярлалаа.", "newsletterError": "Бүртгэл амжилтгүй боллоо. Дахин оролдоно уу.", "newsletterSending": "илгээж байна…"`

Keep key order consistent across files. Reuse existing `musicPage.email` for
the placeholder. (`newsletterSend` labels the icon-only submit button for
screen readers — do NOT reuse `nav.reachOut`, which means the contact page,
not subscribing.)

**Verify**: `npm run build` → exit 0 (JSON parse errors fail the build).

### Step 3: Subscribe route

Create `src/app/api/subscribe/route.ts`. Ordering matters and must match the
message wall: honeypot check FIRST (bot hits must not consume rate budget),
then rate limit, then validation:

```ts
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const subscribersFile = path.join(process.cwd(), "data", "subscribers.ndjson");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; website?: string } | null;
  if (body?.website) return Response.json({ ok: true }, { status: 202 }); // honeypot — no rate budget spent

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const { ok, retryAfterSec } = rateLimit(`subscribe:${ip}`, 5, 60 * 60 * 1000);
  if (!ok) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(retryAfterSec) } });

  const email = body?.email?.trim().toLowerCase() ?? "";
  if (!emailPattern.test(email) || email.length > 254) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  await mkdir(path.dirname(subscribersFile), { recursive: true }); // fresh clones have no data/ (gitignored content)
  await appendFile(subscribersFile, `${JSON.stringify({ email, createdAt: new Date().toISOString() })}\n`, "utf8");

  const apiKey = process.env.BUTTONDOWN_API_KEY;
  if (apiKey) {
    const response = await fetch("https://api.buttondown.com/v1/subscribers", {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok && response.status !== 409) {
      // 409 = already subscribed; still a success for the visitor.
      return Response.json({ error: "Provider error" }, { status: 502 });
    }
  }

  return Response.json({ ok: true }, { status: 201 });
}
```

Notes: never log or echo the API key; local NDJSON is the source of truth so
a provider outage never loses addresses (provider failures return 502 AFTER
the local write — acceptable and documented here). Duplicate emails are NOT
deduplicated locally — the provider's 409 tolerance covers forwarding, and
the rate limit is the only brake on repeat local writes (documented in
Maintenance notes).

**Verify**: `npm run build` → exit 0.

### Step 4: Form component

Create `src/components/newsletter-form.tsx` following the ReachOut status
pattern. The honeypot copies the message wall's off-screen REAL input (not
`type="hidden"` — bots that skip hidden fields will never trip a hidden one;
see `reach-out.tsx:87-90` and the `.honeypot` CSS):

```tsx
"use client";

import { FormEvent, useState } from "react";
import { ArrowRight } from "lucide-react";

type Copy = { email: string; send: string; sending: string; success: string; error: string };

export function NewsletterForm({ copy }: { copy: Copy }) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const data = { email: String(formData.get("email") ?? ""), website: String(formData.get("website") ?? "") };
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("subscribe failed");
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="newsletter-form" onSubmit={handleSubmit}>
      <div className="field honeypot" aria-hidden="true">
        <label htmlFor="newsletter-website">Website</label>
        <input id="newsletter-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <input name="email" type="email" required maxLength={254} placeholder={copy.email} aria-label={copy.email} />
      <button type="submit" disabled={status === "sending"} aria-label={status === "sending" ? copy.sending : copy.send}>
        <ArrowRight aria-hidden="true" size={14} strokeWidth={1.7} />
      </button>
      <p className="form-status" aria-live="polite">
        {status === "success" ? copy.success : null}
        {status === "error" ? copy.error : null}
      </p>
    </form>
  );
}
```

Append CSS:

```css
.newsletter-form{position:relative;display:flex;align-items:center}.newsletter-form input[type=email]{width:100%;padding:10px 44px 10px 14px;border:1px solid var(--rule);border-radius:0;background:transparent;color:var(--ink);font-size:12px}.newsletter-form button{position:absolute;right:6px;display:grid;width:30px;height:30px;place-items:center;border:0;background:none;color:var(--muted);cursor:pointer}.newsletter-form .form-status{position:absolute;top:100%;left:0;margin:6px 0 0;font-size:11px;color:var(--muted)}
```

### Step 5: Swap into the music page

In `src/app/[lang]/music/page.tsx:36`, replace only the fake-input div:

```tsx
<div className="fake-input">{copy.musicPage.email}<span>→</span></div>
```

with:

```tsx
<NewsletterForm copy={{ email: copy.musicPage.email, send: copy.musicPage.newsletterSend, sending: copy.musicPage.newsletterSending, success: copy.musicPage.newsletterSuccess, error: copy.musicPage.newsletterError }} />
```

plus the import. Leave the rest of the `music-cta` section untouched.

**Verify**: `npm run lint` → exit 0; `npm run build` → exit 0.

### Step 6: Runtime verification

Start `npm run dev`, then:

```sh
curl -s -w "\n%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{"email":"listener@example.com"}' http://localhost:3000/api/subscribe
# expect: {"ok":true} and 201
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{"email":"not-an-email"}' http://localhost:3000/api/subscribe
# expect: 400
cat data/subscribers.ndjson
# expect one line containing listener@example.com
git status --short data/
# expect: nothing (ignored)
```

Manual browser pass: `/en/music` shows a real input with arrow button;
submitting a valid email shows the success string; garbage input is blocked
by native validation.

## Test plan

No test framework exists. Step 6's curl matrix plus manual pass is the test
plan: valid subscribe (201 + file line), invalid email (400), honeypot
short-circuit (202, and it must NOT consume rate budget — 5 real posts after
a honeypot hit should still succeed), rate limiting (6 rapid posts → 429 with
`Retry-After`; restart dev server to reset buckets between checks), and
gitignore coverage of `data/`.

## Done criteria

- [ ] `npm run lint` exits 0; `npm run build` exits 0
- [ ] curl matrix expectations hold; `data/subscribers.ndjson` gains exactly one line per valid POST
- [ ] `git check-ignore data/subscribers.ndjson` → exits 0 (ignored)
- [ ] `grep -c "fake-input" src/app/[lang]/music/page.tsx` → 0
- [ ] All three message JSON files contain the four new keys (`newsletterSend`, `newsletterSending`, `newsletterSuccess`, `newsletterError`)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `src/lib/rate-limit.ts` does not exist (plan 002 not done) — execute it first.
- Dictionary files or `music/page.tsx` contain changes NOT explained below
  (merge conflict risk) — report.
  - **Expected if plans/001 landed first (do NOT stop for these):**
    `musicPage.tracklist` added to all three message JSON files;
    `DiscographyFilter` + wired featured links in `music/page.tsx`.
  - Anything else unexpected in those files → stop and report.
- The Buttondown API rejects the documented endpoint shape — report; do not
  swap providers without operator approval.
- Any step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Without `BUTTONDOWN_API_KEY` set, signups accumulate only in
  `data/subscribers.ndjson` (gitignored); importing them later is a manual
  step. Set the env var before any serverless deploy (the file won't be
  writable there — same constraint already noted for the message wall).
- Duplicate emails are not deduplicated locally; the provider's 409 handling
  covers forwarding. If local dedupe is ever needed, read-before-append here
  mirrors the message wall's cap logic.
- If a second signup surface is added, extract the form copy/type into a
  shared module rather than duplicating the `Copy` shape.
