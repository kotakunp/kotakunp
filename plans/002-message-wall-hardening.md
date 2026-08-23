# Plan 002: Harden the message wall — rate limiting, storage cap, conditional polling

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6bc950a..HEAD -- src/app/api/messages src/components/reach-out.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `6bc950a`, 2026-08-21

## Why this matters

The public message wall (`POST /api/messages`) appends every accepted message
to an on-disk NDJSON file with no rate limit: a scripted visitor can grow that
file without bound and flood the public wall. Additionally, every open contact
page polls `GET /api/messages` every 15 seconds and receives the full list
every time. This plan adds per-IP rate limiting, caps the stored file size,
and makes polling conditional (ETag/304) so unchanged walls cost ~nothing.

## Current state

- `src/app/api/messages/route.ts` — the entire API. Key excerpts:
  ```ts
  // src/app/api/messages/route.ts:14
  const messageFile = path.join(process.cwd(), "data", "reach-out.ndjson");

  // :35-45 — POST reads formData, honeypot check, length validation
  export async function POST(request: Request) {
    const formData = await request.formData();
    const website = String(formData.get("website") ?? "").trim();
    ...
    if (message.length < 2 || message.length > 500 || rawName.length > 40) {
      return Response.json({ error: "Invalid message" }, { status: 400 });
    }
  ```
  There is no rate limiting anywhere and no cap on file growth.
- `src/components/reach-out.tsx:41` — client polls with caching disabled:
  ```ts
  const response = await fetch("/api/messages", { cache: "no-store" });
  ```
  and `reach-out.tsx:54` sets a 15s interval.
- `src/app/globals.css:16` defines `.honeypot{position:absolute;left:-9999px}`
  (the honeypot pattern to copy for any new forms).
- No test framework; verification is lint + build + curl against a dev server.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint    | `npm run lint`  | exit 0 |
| Build   | `npm run build` | exit 0 |
| Dev server | `npm run dev` | serves on :3000 |

## Scope

**In scope**:
- `src/lib/rate-limit.ts` (create)
- `src/app/api/messages/route.ts` (modify)
- `src/components/reach-out.tsx` (modify — ETag ref + loadMessages rewrite)

**Out of scope**:
- Any database/storage migration (NDJSON stays; the dictionary string at
  `en.json` `reachOut.prototypeNote` already documents this).
- The honeypot/validation logic itself (works; leave thresholds as-is).
- plans/007's `/api/subscribe` route (it will reuse this module later).

## Git workflow

- Branch: `advisor/002-message-wall-hardening`
- Commit per step; short imperative lowercase messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the rate-limit module

Create `src/lib/rate-limit.ts`:

```ts
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}
```

In-memory state is acceptable for this single-instance deployment; add a
header comment noting it resets on restart and does not cluster.

**Verify**: `npx tsc --noEmit` after `npm run build` has run once → exit 0.

### Step 2: Apply rate limiting + storage cap in POST

Modify `src/app/api/messages/route.ts`:

- Extend the existing fs import (only `appendFile`/`readFile` are imported
  today):
  ```ts
  import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
  ```
- Import `rateLimit` from `@/lib/rate-limit`.
- Derive the client key and apply the limit IMMEDIATELY AFTER the honeypot
  early-return (`if (website) return Response.json({ ok: true }, { status: 202 });`)
  — not at the top of the function — so honeypot hits do not consume rate
  budget but real submissions do:
  ```ts
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const { ok, retryAfterSec } = rateLimit(`messages:${ip}`, 5, 60 * 60 * 1000);
  if (!ok) return Response.json({ error: "Too many messages" }, { status: 429, headers: { "Retry-After": String(retryAfterSec) } });
  ```
- Before the existing `appendFile`, ensure the data directory exists (a fresh
  clone has no `data/` — it is untracked content):
  ```ts
  await mkdir(path.dirname(messageFile), { recursive: true });
  ```
- After that `appendFile`, cap the file at the most recent 1000 entries:
  ```ts
  const all = await readAllLines();
  if (all.length > 1000) {
    await writeFile(messageFile, all.slice(-1000).map((l) => `${JSON.stringify(l)}\n`).join(""), "utf8");
  }
  ```
  Implement a small private `readAllLines()` by refactoring the parse logic
  out of the existing `readMessages()` (same split/filter/map, returning the
  parsed entries without slicing/reversing); keep `readMessages()` behavior
  identical (last 30, newest first).

**Verify**: `npm run build` → exit 0.

### Step 3: Conditional GET with ETag

Still in `route.ts`, change `GET` to:

```ts
import { createHash } from "node:crypto";

export async function GET(request: Request) {
  let source: string;
  try {
    source = await readFile(messageFile, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") source = "";
    else throw error;
  }
  const etag = `"${createHash("sha1").update(source).digest("hex")}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  const messages = source ? JSON.parse(`[${source.trim().split("\n").filter(Boolean).join(",")}]`) : [];
  return Response.json({ messages: messages.slice(-30).reverse() }, { headers });
}
```

`readFile` is ALREADY imported at the top of `route.ts` — do not re-import
it; only add the `createHash` import.

The `Cache-Control: private, no-cache` header is load-bearing: this route is
`force-dynamic`, so Next would otherwise send `no-store` and the browser
would never revalidate. `no-cache` means "store but revalidate every time",
which is exactly the ETag polling behavior we want.

### Step 4: Client-side conditional requests

The browser will now receive `ETag` + `Cache-Control: private, no-cache`, but
the client must drive revalidation itself (a 304 has `response.ok === false`,
so it must be handled BEFORE any `!response.ok` check). In
`src/components/reach-out.tsx`:

- Add a ref alongside the state declarations. `useRef` is NOT in the current
  React import (`reach-out.tsx:3` imports `FormEvent, useCallback, useEffect,
  useMemo, useState`) — add it:
  ```ts
  import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
  ...
  const etagRef = useRef<string | null>(null);
  ```
- Replace `loadMessages` with:

```ts
const loadMessages = useCallback(async () => {
  try {
    const headers: HeadersInit = {};
    if (etagRef.current) headers["If-None-Match"] = etagRef.current;
    const response = await fetch("/api/messages", { headers, cache: "no-store" });
    if (response.status === 304) return; // wall unchanged; keep current state
    if (!response.ok) throw new Error("Message wall unavailable");
    const etag = response.headers.get("ETag");
    if (etag) etagRef.current = etag;
    const data = (await response.json()) as { messages: PublicMessage[] };
    setMessages(data.messages);
  } catch {
    setStatus("error");
  } finally {
    setLoading(false);
  }
}, []);
```

Keeping `cache: "no-store"` on the fetch is intentional: it disables the
browser HTTP cache so OUR conditional-request logic above is the only
mechanism (no double-caching semantics to reason about).

**Verify**: `npm run lint` → exit 0; `npm run build` → exit 0.

### Step 5: Runtime verification with curl

Start `npm run dev` in a terminal, then:

```sh
# Baseline GET captures an ETag
ETAG=$(curl -s -D - -o /dev/null http://localhost:3000/api/messages | grep -i '^etag' | tr -d '\r' | cut -d' ' -f2)
echo "$ETAG"                                # a quoted hex string

# Conditional GET returns 304
curl -s -o /dev/null -w "%{http_code}\n" -H "If-None-Match: $ETAG" http://localhost:3000/api/messages
# expect: 304

# Rate limit: 5 accepted then 429 (run from bash; each POST is a fresh request)
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w "%{http_code} " -F "name=t$i" -F "message=hello $i" http://localhost:3000/api/messages
done; echo
# expect: 201 201 201 201 201 429
```

Note: curl does not send `X-Forwarded-For`, so all requests share the
`"local"` bucket — restart the dev server to reset buckets between test runs.

**Verify**: all three expectations above hold.

## Test plan

No test framework exists. The curl sequence in Step 5 IS the test plan:
happy-path POST (201), rate-limit rejection (429 + Retry-After header),
conditional GET (304), and ETag invalidation (post a message after a 304,
then re-GET → 200 with a different ETag). For the browser path, the manual
check is: open `/en/contact`, watch the Network tab — after the first load,
subsequent 15s polls return 304 and the wall does not flash or error.

## Done criteria

- [ ] `npm run lint` exits 0; `npm run build` exits 0
- [ ] 6th POST within an hour from one IP returns 429 with a `Retry-After` header
- [ ] `GET /api/messages` response carries both `ETag` and `Cache-Control: private, no-cache`
- [ ] GET with matching `If-None-Match` returns 304; browser polls show 304s in devtools without error state
- [ ] `wc -l data/reach-out.ndjson` never exceeds 1000 after the cap logic (inspect code; simulating 1000 writes is not required)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `route.ts` no longer matches the Current-state excerpts (validation or
  honeypot behavior changed).
- The dev server environment ignores `x-forwarded-for` in a way that gives
  every request a distinct IP (would make the curl rate-limit test
  meaningless) — report instead of weakening the limiter.
- Any step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The limiter is per-instance memory. If the site ever deploys serverless or
  multi-instance, replace it with a shared store — the module boundary
  (`rateLimit(key, limit, windowMs)`) is the seam.
- `x-forwarded-for` is client-spoofable unless the hosting platform
  overwrites it. On Vercel it is trustworthy; on a raw Node host behind no
  proxy, all visitors share one bucket (fail-closed, acceptable) but a
  spoofed header could rotate buckets — revisit if self-hosting.
- The append-then-rewrite cap can lose a line under concurrent POSTs
  (read-modify-write race). Acceptable at this scale; switch to an
  append-only rotation scheme if traffic grows.
- plans/007 (newsletter) imports this same module for its subscribe route.
