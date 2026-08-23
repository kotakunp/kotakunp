# Plan 004: Audio previews on release pages

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6bc950a..HEAD -- src/content/release-details.ts src/app/[lang]/music/[slug] src/components/release-card.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition — EXCEPT the existence of
> `release-details.ts` and the `[slug]` route themselves (created by plans/001,
> which must be landed first; their content is described in Current state).
> In particular, this plan REQUIRES plan 001 to be DONE (the
> `release-details.ts` module and `src/app/[lang]/music/[slug]/page.tsx`
> must exist).

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-release-detail-pages.md (must be landed first — see `plans/README.md` for live status)
- **Category**: direction
- **Planned at**: commit `6bc950a`, 2026-08-21

## Why this matters

This is a music site where nothing can be heard. Release detail pages (plan
001) render metadata, tracklists, and lyrics — but no sound. This plan adds
an optional per-release preview clip with a small branded play/pause player,
plus a Node script that synthesizes a real placeholder WAV so the feature is
verifiable end-to-end before the artist supplies real clips.

## Current state

After plan 001:

- `src/content/release-details.ts` exports:
  ```ts
  export type ReleaseDetail = {
    description: string;
    tracks?: ReleaseTrack[];
    lyrics?: ReleaseLyrics;
  };
  export const releaseDetails: Record<string, ReleaseDetail> = { ... };
  ```
- `src/app/[lang]/music/[slug]/page.tsx` renders sections conditionally on
  `detail?.tracks` / `detail?.lyrics` inside `<article className="release-detail page-width">`.
- `src/components/release-card.tsx` renders a decorative
  `<Play className="play-icon" ... size={14} fill="currentColor" />` icon on
  non-detailed cards.
- Styling conventions: dense one-line CSS appended to `src/app/globals.css`;
  icons from `lucide-react` at small sizes with `strokeWidth={1.7}`; client
  components start with `"use client";` (see `src/components/reach-out.tsx:1`).
- There is no `public/audio/` directory yet.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint    | `npm run lint`  | exit 0 |
| Build   | `npm run build` | exit 0 |
| Dev server | `npm run dev` | serves on :3000 |

## Scope

**In scope**:
- `scripts/make-test-tone.mjs` (create)
- `public/audio/transparent-city-and-rain-preview.wav` (create, via the script)
- `src/content/release-details.ts` (modify — add optional `preview` field)
- `src/components/audio-preview.tsx` (create)
- `src/app/[lang]/music/[slug]/page.tsx` (modify — render player when present)
- `src/app/globals.css` (append styles)

**Out of scope**:
- Wiring the `Play` icon on `ReleaseCard` to audio (cards stay decorative;
  playback lives on detail pages).
- Any real encoded music assets — maintainer-supplied later.
- Autoplay, playlist/queue behavior, or a site-wide persistent player.

## Git workflow

- Branch: `advisor/004-audio-previews`
- Commit per step; short imperative lowercase messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extend the content model

In `src/content/release-details.ts`, extend the type and seed one entry:

```ts
export type ReleasePreview = { src: string; duration: string };

export type ReleaseDetail = {
  description: string;
  tracks?: ReleaseTrack[];
  lyrics?: ReleaseLyrics;
  preview?: ReleasePreview;
};
```

Add to the `"transparent-city-and-rain"` entry only:

```ts
preview: { src: "/audio/transparent-city-and-rain-preview.wav", duration: "0:03" },
```

**Verify**: `npm run build` → exit 0.

### Step 2: Synthesize a placeholder clip

Create `scripts/make-test-tone.mjs` (Node core only — no dependencies):

```js
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const sampleRate = 8000;
const seconds = 3;
const samples = sampleRate * seconds;
const data = Buffer.alloc(samples * 2);
for (let i = 0; i < samples; i++) {
  const envelope = Math.min(1, i / 800, (samples - i) / 800);
  const value = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 12000 * envelope);
  data.writeInt16LE(value, i * 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write("data", 36); header.writeUInt32LE(data.length, 40);
mkdirSync("public/audio", { recursive: true });
writeFileSync(path.join("public/audio", "transparent-city-and-rain-preview.wav"), Buffer.concat([header, data]));
console.log("wrote public/audio/transparent-city-and-rain-preview.wav");
```

Run it: `node scripts/make-test-tone.mjs`.

**Verify**: `ls -la public/audio/` shows an ~48KB wav; `file public/audio/*.wav`
reports "WAVE audio ... 8000 Hz ... mono".

### Step 3: Build the player component

Create `src/components/audio-preview.tsx`. Playback state is driven by the
audio element's own events (`onPlay`/`onPause`/`onEnded`) rather than set
optimistically — `audio.play()` returns a promise that can reject (missing
file, autoplay policy), and event-driven state can never lie. Navigation
away must stop the sound, hence the unmount cleanup:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";

export function AudioPreview({ src, duration }: { src: string; duration: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = ref.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, []);

  function toggle() {
    const audio = ref.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play(); // rejection surfaces via error event; state stays honest
    } else {
      audio.pause();
      audio.currentTime = 0; // the button shows a STOP square — actually stop, don't just pause
    }
  }

  return (
    <div className="audio-preview">
      <button type="button" onClick={toggle} aria-label={playing ? "Stop preview" : "Play preview"}>
        {playing ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
      </button>
      <span className="audio-preview-label">preview</span>
      <time>{duration}</time>
      <audio
        ref={ref}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
```

Append CSS:

```css
.audio-preview{display:flex;align-items:center;gap:14px;margin-top:18px;padding:10px 16px;border:1px solid var(--rule)}.audio-preview button{display:grid;width:30px;height:30px;place-items:center;border:1px solid var(--ink);border-radius:50%;background:none;color:inherit;cursor:pointer}.audio-preview .audio-preview-label{font-size:11px;color:var(--muted)}.audio-preview time{margin-left:auto;font-size:11px;color:var(--faint)}
```

### Step 4: Render it on the detail page

In `src/app/[lang]/music/[slug]/page.tsx`, inside the copy column of
`.release-detail-grid` (after the description paragraph), add:

```tsx
{detail?.preview ? <AudioPreview src={detail.preview.src} duration={detail.preview.duration} /> : null}
```

with `import { AudioPreview } from "@/components/audio-preview";`.

**Verify**: `npm run lint` → exit 0; `npm run build` → exit 0.

### Step 5: Runtime verification

Start `npm run dev`, then:

```sh
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:3000/audio/transparent-city-and-rain-preview.wav
# expect: 200 audio/wav
curl -s http://localhost:3000/en/music/transparent-city-and-rain | grep -c "audio-preview"
# expect >= 1
curl -s http://localhost:3000/en/music/grey-morning | grep -c "audio-preview"
# expect 0
```

Manual browser pass: open `/en/music/transparent-city-and-rain`, click the
round button → tone plays, icon switches to stop square; click again or let
it end → resets.

## Test plan

No test framework exists. The curl matrix plus manual click-through in Step 5
is the test plan: asset served with correct MIME, player present only for the
release whose `preview` is configured, absent otherwise.

## Done criteria

- [ ] `npm run lint` exits 0; `npm run build` exits 0
- [ ] WAV serves as `200 audio/wav`; detail page HTML contains `audio-preview` only for `transparent-city-and-rain`
- [ ] `grep -n "preview?" src/content/release-details.ts` shows the optional field
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Plan 001's files (`release-details.ts`, the `[slug]` route) do not exist —
  execute plans/001 first.
- The browser blocks WAV playback in the manual pass (codec issue) — report;
  do not silently switch formats without operator approval.
- Any step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Real clips replace the tone: drop an MP3/M4A into `public/audio/`, update
  the release's `preview.src/duration`, delete the WAV + script when no longer
  needed.
- Keep clips short (<60s) and mono/small-bitrate; they load on demand
  (`preload="none"`), but they are still static assets shipped from the repo.
- A future site-wide "now playing" widget would reuse this component's
  pattern; keep `AudioPreview` self-contained until then.
