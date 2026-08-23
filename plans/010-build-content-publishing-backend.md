# Plan 010: Build the first-party writing and music publishing backend

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report—do not substitute a CMS, hosted database, auth framework, rich-text
> editor, or cloud media service. When done, update this plan's status in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 6bc950a..HEAD -- package.json package-lock.json next.config.ts .gitignore README.md src scripts drizzle.config.ts plans`
> This site currently exists as uncommitted working-tree work on top of
> `6bc950a`; an empty commit diff therefore does **not** prove the files match.
> Also compare the "Current state" excerpts below with the working tree. If an
> in-scope file has materially changed, treat that as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L (roughly 1–2 focused weeks)
- **Risk**: HIGH
- **Depends on**: none; plans 001–009 are already complete
- **Category**: direction
- **Planned at**: commit `6bc950a`, 2026-08-21

## Decision

Build the content system in this repository. Do **not** adopt Payload, another
CMS, or a hosted content platform.

The implementation is deliberately narrow:

- SQLite on the existing VPS, accessed through Drizzle.
- One author, one password, one signed HttpOnly session cookie.
- Markdown source edited in CodeMirror with a side-by-side preview.
- A flat local media library for images and audio.
- Draft and published states for both journal posts and music releases.
- Release metadata, ordered tracks, lyrics, cover art, smartlinks, and playable
  MP3/M4A uploads.
- Cached public queries invalidated when either content type changes.
- No roles, registration, rich-text document model, comments, collaboration,
  scheduled publishing, revision history, or permissions UI.

This choice has more initial implementation cost than a CMS, but its long-term
surface exactly matches the site: one author, one process, one SQLite file, one
uploads directory. It also avoids making the public journal, discography, or
author workflow dependent on a third-party release cycle.

## Why this matters

Publishing writing currently requires creating an MDX file, registering it in a
handwritten array, committing media, and deploying. Music is similarly split
between `site.ts`, `release-details.ts`, and committed cover/audio files. This
plan makes SQLite the only runtime source for posts and releases, lets the
author upload cover art and playable tracks from the studio, and makes either
kind of publication visible without a build while preserving the site's
paper-and-ink public presentation.

## Current state

- `src/content/journal.ts` manually imports and registers every post:

  ```ts
  // src/content/journal.ts:2-4,21-28
  import BuildingRoom, { metadata as buildingRoom } from "./posts/building-a-small-listening-room.mdx";
  import NotesBeforeVoice, { metadata as notesBeforeVoice } from "./posts/notes-before-the-voice.mdx";
  import TransparentCity, { metadata as transparentCity } from "./posts/transparent-city-and-rain.mdx";

  export const journalPosts: JournalPost[] = [
    { metadata: transparentCity as JournalMetadata, Content: TransparentCity },
    { metadata: notesBeforeVoice as JournalMetadata, Content: NotesBeforeVoice },
    { metadata: buildingRoom as JournalMetadata, Content: BuildingRoom },
  ];
  ```

- `src/app/[lang]/journal/[slug]/page.tsx` prebuilds only those three slugs and
  rejects everything else. This must be removed for publish-without-deploy:

  ```ts
  // src/app/[lang]/journal/[slug]/page.tsx:10-14
  export function generateStaticParams() {
    return locales.flatMap((lang) => journalPosts.map(({ metadata }) => ({ lang, slug: metadata.slug })));
  }
  export const dynamicParams = false;
  ```

- `src/app/feed.xml/route.ts:4` is `force-static` and reads the same array.
- `src/app/sitemap.ts:6-21` includes the journal index but no post URLs.
- `next.config.ts` is wrapped by `@next/mdx`, and `package.json` includes four
  MDX-only packages.
- The three Markdown bodies are in `src/content/posts/*.mdx`; their covers are
  existing WebP files in `public/covers/` and are also legitimate static site
  assets.
- `src/content/site.ts:10-78` manually defines six releases plus a separate
  `featuredTracks` array. `src/content/release-details.ts:17-43` separately maps
  the same slugs to descriptions, an optional tracklist, lyrics, and preview.
  Updating one release correctly therefore requires coordinated edits across
  two modules.
- `src/app/[lang]/music/[slug]/page.tsx:14-18` also uses
  `generateStaticParams()` plus `dynamicParams = false`, so a newly published
  database release cannot exist until this closed route behavior is removed.
- `src/app/[lang]/music/page.tsx`, `src/app/[lang]/page.tsx`,
  `src/components/release-card.tsx`, `src/components/discography-filter.tsx`,
  the music OG route, and `src/app/sitemap.ts` all import the handwritten release
  data directly. Every one must switch in the same cutover.
- The only current playable asset is
  `public/audio/transparent-city-and-rain-preview.wav`; the other five dummy
  releases have counts/durations but no track rows or audio files.
- Public journal styling is concentrated in `src/app/globals.css` under
  `.journal-*` and `.mdx-content`. Preserve its warm paper, thin rules,
  monochrome imagery, mono type, spacing, and hover behavior. New public
  controls should extend those rules, not redesign them.
- Public UI dictionaries live in `src/messages/{en,ja,mn}.json`. Journal
  articles are intentionally English-only; only navigation/filter labels need
  translation.
- `src/app/api/messages/route.ts` and `src/app/api/subscribe/route.ts` use
  NDJSON and must remain untouched.
- `src/components/audio-preview.tsx` is the existing compact audio interaction;
  reuse its visual language for inline journal audio.
- Baseline on 2026-08-21: `npm run lint` and `npm run build` both exit 0. The
  repository has no test runner yet.

## Target architecture

```text
/studio (responsive author UI for posts, releases, tracks, and media)
  -> authenticated route handlers
     -> repositories / Drizzle
        -> data/content.sqlite (+ WAL files)
     -> media service
        -> data/uploads/images/*
        -> data/uploads/audio/*
     -> revalidate journal/music cache tags after published-state changes

public RSC pages, RSS, sitemap, and OG routes
  -> cached journal and music query functions
     -> published rows only
        -> SQLite on a cache miss
```

The database is the only active source of posts and releases after cutover.
Markdown remains the stored format for article bodies and lyrics; rendering
does not execute MDX or arbitrary HTML.

## Data contract

Create these Drizzle tables in `src/db/schema.ts`:

### `journal_posts`

| Column | Type / rule |
|---|---|
| `id` | text UUID primary key |
| `slug` | non-empty text, unique, indexed |
| `title` | text, 1–160 characters |
| `excerpt` | text, 1–320 characters |
| `type` | text, 1–40 characters; editorial label such as `studio note` |
| `body_markdown` | non-empty text |
| `status` | text enum: `draft` or `published` |
| `cover_media_id` | nullable FK to `media.id`, `onDelete: set null` |
| `published_at` | nullable integer timestamp; required when published |
| `created_at` | integer timestamp, required |
| `updated_at` | integer timestamp, required |

### `tags`

`id` (UUID), `name` (1–40 chars), `slug` (unique/indexed). Slugs are generated
server-side and tags are upserted by normalized slug.

### `journal_post_tags`

Composite primary key (`post_id`, `tag_id`) with cascade deletion from either
parent.

### `journal_post_media`

Composite primary key (`post_id`, `media_id`) with cascade deletion. Sync it by
parsing same-site image URLs and `audio` directives whenever Markdown is saved.
This is required so the media route can distinguish publicly referenced media
from private draft uploads without trusting an unguessable URL.

### `music_releases`

| Column | Type / rule |
|---|---|
| `id` | text UUID primary key |
| `slug` | non-empty text, unique, indexed |
| `title` | primary/original-language title, 1–160 characters |
| `english_title` | text, 1–160 characters |
| `type` | enum: `single`, `ep`, `album`, `ost` |
| `description_markdown` | Markdown, 1–2,000 characters |
| `status` | `draft` or `published` |
| `cover_media_id` | nullable FK to `media.id`, `onDelete: set null` |
| `release_date` | nullable integer timestamp; required when published |
| `declared_track_count` | nullable positive integer for imported catalog entries without track rows |
| `declared_duration_ms` | nullable positive integer for imported catalog entries without track rows |
| `duu_to_url` | nullable HTTPS URL |
| `youtube_url`, `spotify_url`, `apple_music_url` | nullable HTTPS URLs |
| `published_at`, `created_at`, `updated_at` | integer timestamps; publication nullable |

### `music_tracks`

| Column | Type / rule |
|---|---|
| `id` | text UUID primary key |
| `release_id` | FK to `music_releases.id`, cascade delete |
| `position` | positive integer; unique with `release_id` |
| `title` | text, 1–160 characters |
| `english_title` | nullable text |
| `lyrics_markdown` | nullable Markdown; raw HTML disabled |
| `audio_media_id` | nullable FK to `media.id`, `onDelete: set null` |
| `audio_kind` | enum: `none`, `preview`, `full` |
| `duration_ms` | nullable positive integer, populated from uploaded audio metadata |
| `created_at`, `updated_at` | integer timestamps |

Track count and total duration are derived from real track rows when present.
The `declared_*` fallback exists only to preserve the five current dummy catalog
entries until the author supplies their actual tracklists; new studio releases
should not populate it.

### `media`

| Column | Type / rule |
|---|---|
| `id` | text UUID primary key |
| `kind` | `image` or `audio` |
| `original_name` | display-only filename, never used as a path |
| `storage_key` | unique server-generated relative path |
| `public_path` | unique URL path (`/media/<id>/<safe-name>`) or bundled cover path |
| `mime_type` | allowlisted MIME determined from bytes, not client header |
| `byte_size` | integer |
| `alt` | nullable text; required when selected as a post cover |
| `duration_ms` | nullable integer for audio; extract with `music-metadata` |
| `width`, `height` | nullable integers for images |
| `source` | `upload` or `bundled` |
| `created_at` | integer timestamp |

Do not add an author/user table. The single author's credential and session
signing secret remain environment secrets, not content data. Media is private
unless it is bundled or referenced by a published post/release/track; studio
sessions may preview private media.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install runtime deps | `npm install drizzle-orm better-sqlite3 jose zod react-markdown remark-gfm remark-directive @uiw/react-codemirror @codemirror/lang-markdown file-type music-metadata` | exit 0; lockfile updated |
| Install dev deps | `npm install -D drizzle-kit @types/better-sqlite3 vitest tsx` | exit 0; lockfile updated |
| Generate migration | `npm run db:generate` | creates a migration under `drizzle/` |
| Apply migrations | `npm run db:migrate` | exits 0 and prints applied migration count |
| Unit/integration tests | `npm test` | all tests pass |
| Lint | `npm run lint` | exit 0 |
| Production build | `npm run build` | exit 0 |

## Suggested executor toolkit

- Read the relevant installed Next.js 16 guides under
  `node_modules/next/dist/docs/` before implementing route handlers, cookies,
  `unstable_cache`, `revalidateTag`, or `revalidatePath`. This repository's
  `AGENTS.md` explicitly requires bundled docs over remembered APIs.
- Use the `vercel-react-best-practices` skill if available when splitting the
  server-rendered studio shell from the CodeMirror client island.
- Use the existing one-line/dense CSS conventions rather than introducing a
  component library.

## Scope

**In scope**:

- `package.json`, `package-lock.json`
- `next.config.ts`, `.gitignore`, `.env.example`, `README.md`
- `drizzle.config.ts` (create), `drizzle/**` (create)
- `src/db/**` (create)
- `src/lib/auth/**`, `src/lib/journal/**`, `src/lib/music/**`,
  `src/lib/media/**` (create)
- `src/components/journal-markdown.tsx` (create)
- `src/components/journal-audio.tsx` (create)
- `src/components/studio/**` (create)
- `src/app/studio/**` (create)
- `src/app/api/studio/**` (create)
- `src/app/media/[...path]/route.ts` (create)
- Existing public journal page, post page, post OG route, RSS route, sitemap,
  CSS, and public dictionaries
- Existing home page, music index/detail/OG routes, `release-card.tsx`,
  `discography-filter.tsx`, and `audio-preview.tsx`
- `src/content/journal.ts`, `src/content/posts/*.mdx`, `src/mdx.d.ts`, and
  root `mdx-components.tsx` (delete after cutover)
- `src/content/release-details.ts` (delete) and the `releases` /
  `featuredTracks` exports in `src/content/site.ts` (remove after migration)
- `scripts/content/**` and `scripts/backup/**` (create)
- `docs/content-operations.md` (create)
- `plans/README.md` (status only when executing)

**Out of scope**:

- `src/app/api/messages/**`, `src/app/api/subscribe/**`, or their NDJSON files
- Moving the message wall or subscribers into SQLite
- Multiple authors, registration, roles, password recovery, OAuth, or invites
- WYSIWYG/rich-text editing, arbitrary HTML/MDX execution, collaborative editing
- Comments, reactions, analytics, scheduled publishing, revisions/versioning
- Cloud/S3 media, image transformation pipelines, or a CDN
- Changing the public journal's visual direction or localizing article bodies
- Project publishing; `projects` and the non-music profile data remain in code
- Distributing music to Spotify, Apple Music, YouTube, or other DSPs. The studio
  publishes playable music on this website and stores outbound smartlinks only.
- Audio transcoding, loudness normalization, mastering, waveform generation,
  DRM, download sales, streaming analytics, or a persistent global player

## Git workflow

- Suggested branch: `codex/010-content-publishing-backend`
- The only existing commit is `6bc950a Initial commit from Create Next App`, so
  use clear imperative commits by phase, for example:
  `Add SQLite content schema`, `Add authenticated publishing studio`,
  `Switch public writing and music to database`.
- Do not push or open a PR unless the operator asks.
- Preserve unrelated dirty working-tree changes. Never reset the repository.

## Steps

### Step 1: Add and test the SQLite/Drizzle foundation

1. Install the dependencies from the command table. Add scripts:

   ```json
   "db:generate": "drizzle-kit generate",
   "db:migrate": "tsx scripts/content/migrate.ts",
   "db:studio": "drizzle-kit studio",
   "post:new": "tsx scripts/content/new-post.ts",
   "release:new": "tsx scripts/content/new-release.ts",
   "content:backup": "scripts/backup/content-backup.sh",
   "content:restore-check": "scripts/backup/restore-check.sh",
   "test": "vitest run"
   ```

2. Add `.env.example` with names and safe examples only:

   ```dotenv
   CONTENT_DATABASE_PATH=./data/content.sqlite
   CONTENT_UPLOADS_PATH=./data/uploads
   STUDIO_PASSWORD_SALT=<generate-random-base64>
   STUDIO_PASSWORD_HASH=<scrypt-derived-base64>
   STUDIO_SESSION_SECRET=<generate-at-least-32-random-bytes-base64>
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

3. Add `drizzle.config.ts`, `src/db/schema.ts`, `src/db/client.ts`, and
   `src/db/migrate.ts`. Requirements:

   - Resolve configured paths to absolute paths once on the server.
   - Create only the parent directory; do not silently create a new DB when a
     production path is misspelled after the app has already been provisioned.
   - Enable `PRAGMA journal_mode = WAL`, `foreign_keys = ON`, and a 5-second
     busy timeout on connection startup.
   - Keep the connection in a development `globalThis` singleton so hot reload
     does not open unbounded handles.
   - Add `serverExternalPackages: ["better-sqlite3"]` to `next.config.ts` if the
     installed Next 16 documentation/config type requires it.

4. Generate the structural migration. Add repository functions under
   `src/lib/journal/repository.ts` and `src/lib/music/repository.ts`; pages and
   route handlers must not contain raw Drizzle queries.
5. Add Vitest tests using a temporary SQLite file for:
   schema migration, unique post/release slugs, cascade joins and tracks,
   per-release track-position uniqueness, cover/audio `set null`, and
   published/draft filtering in both domains.

**Verify**:

- `CONTENT_DATABASE_PATH=/tmp/kotakunp-plan010.sqlite npm run db:migrate` → exit
  0; a second run is also exit 0 with no duplicate migration.
- `npm test -- src/db` → all DB tests pass.
- `npm run lint` → exit 0.

### Step 2: Implement the single-user authentication boundary

Create:

- `src/lib/auth/password.ts` — derive and compare the configured scrypt hash;
  validate decoded byte lengths before `timingSafeEqual`.
- `src/lib/auth/session.ts` — sign and verify a short JWT with `jose`, containing
  only `sub: "owner"`, `iat`, and `exp` (7-day maximum).
- `src/lib/auth/request.ts` — `requireStudioSession()` and an exact-origin check
  for every mutating request.
- `src/app/api/studio/session/route.ts` — POST login and DELETE logout.
- `src/app/studio/login/page.tsx` plus a small client form.
- `src/app/studio/layout.tsx` — redirect unauthenticated requests to login;
  allow the login child route without a redirect loop by using an appropriate
  route-group split if required by Next 16.

Cookie requirements:

- name `__Host-kotakunp-studio` in production and a clearly named non-Host
  variant in local HTTP development;
- `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` in production;
- never store the plaintext password, its hash, or the session secret in the DB,
  client bundle, response JSON, logs, or URL;
- all `/api/studio/**` handlers return 401 when the cookie is absent/invalid;
- mutating handlers return 403 when `Origin` does not exactly match
  `NEXT_PUBLIC_SITE_URL`;
- reuse or extract the existing per-process rate-limit pattern for login only:
  5 failed attempts per IP per 15 minutes. Do not modify message-wall behavior.

Add `scripts/content/hash-password.ts` to prompt without echo if possible, or
accept password through stdin; it prints salt/hash values but never writes an
`.env` file.

Tests must cover a correct password, wrong password, malformed configured hash,
expired/tampered token, cookie flags, missing session, and foreign Origin.

**Verify**:

- `npm test -- src/lib/auth src/app/api/studio/session` → all tests pass.
- With dev server running, unauthenticated `curl -i http://localhost:3000/api/studio/posts`
  → 401; `curl -i http://localhost:3000/studio` → redirects to `/studio/login`.
- `npm run build` → exit 0; no secret value appears in `.next/static` when
  searched with a unique test sentinel.

### Step 3: Add validated post, release, track, and media APIs

Create Zod schemas in `src/lib/journal/validation.ts` and
`src/lib/music/validation.ts`, plus route handlers:

- `GET/POST /api/studio/posts`
- `GET/PATCH/DELETE /api/studio/posts/[id]`
- `GET/POST /api/studio/releases`
- `GET/PATCH/DELETE /api/studio/releases/[id]`
- `POST /api/studio/releases/[id]/tracks`
- `PATCH/DELETE /api/studio/releases/[id]/tracks/[trackId]`
- `POST /api/studio/releases/[id]/tracks/reorder`
- `GET/POST /api/studio/media`

Rules:

- Generate UUIDs and slug candidates on the server. A user may edit the slug,
  but uniqueness failures return 409 with a field-level error.
- POST creates a post or release draft immediately from a title; incomplete
  bodies, metadata, covers, and tracklists are allowed until publish. This is
  what makes a sub-30-second draft possible.
- PATCH is a transaction: validate fields, upsert/sync tags, set `published_at`
  on first publish, then update `updated_at`.
- Publishing requires title, slug, excerpt, type, non-empty body, a cover with
  non-empty alt text, and at least one tag. A draft can be incomplete.
- Publishing a music release requires original and English titles, slug, type,
  release date, non-empty description, and a cover with alt text. A release may
  be a metadata-only catalog entry, but if it contains tracks their positions
  and titles must be valid. A track marked `preview` or `full` must reference an
  audio media row; a track with no audio must be `none`.
- Track create/update/reorder happens inside transactions. Reorder accepts the
  complete ordered list of track IDs, rejects missing/foreign/duplicate IDs,
  and rewrites positions without transient unique-key collisions.
- Track counts and duration are derived from track rows. The studio must not
  expose the imported-only `declared_*` fallback fields.
- Validate all smartlinks as HTTPS. Store platform URLs; do not call or upload
  to duu.to, YouTube, Spotify, or Apple Music.
- DELETE requires the current title as a confirmation string. It deletes the
  post and joins, not media files; media cleanup stays explicit.
- JSON bodies are capped before parsing. Return a stable shape:
  `{ data, error: null }` or `{ data: null, error: { code, message, fields? } }`.

Media upload requirements:

- Use a raw streaming request body rather than `request.formData()` so a large
  audio file is never buffered entirely in memory. Pass the display filename
  and declared kind in bounded headers or validated query fields; the studio's
  drag/drop and file picker both call this endpoint.
- Allow images: PNG, JPEG, WebP; max 12 MiB.
- Allow public playback audio: MP3 and M4A/AAC; max 150 MiB. WAV/FLAC masters,
  transcoding, and automatic mastering are out of scope. If byte sniffing or
  `music-metadata` cannot reliably identify/measure a format, STOP and narrow
  the allowlist rather than trusting the browser MIME type.
- Determine MIME from magic bytes with `file-type`; client MIME is advisory.
- Extract audio duration with `music-metadata`; reject an audio upload whose
  duration cannot be read. Duration displayed publicly comes from this value,
  not a manually typed string.
- Generate the disk name from a UUID plus a server-selected extension. Strip
  path separators/control characters from display names.
- Stream/write to a temporary file in the configured uploads directory, then
  atomically rename only after validation and DB insertion preparation.
- On DB failure, delete the just-written file. On file failure, do not insert a
  media row.
- Never accept a client-supplied filesystem path.
- Respond with media metadata and its public URL so the editor can insert it.

Create `src/app/media/[...path]/route.ts` using the media row as the authority,
not the path string. It MUST declare `export const runtime = "nodejs";`
(filesystem streaming and better-sqlite3 require it). It must support GET and
HEAD, `ETag`, immutable cache
headers for UUID filenames, and single HTTP byte ranges for audio. Before
serving, resolve visibility: bundled media or media referenced by a published
post, release cover, or published release track is public; all other media
requires a valid studio session and returns `Cache-Control: private, no-store`.
Reject traversal, unknown IDs, unsupported multi-range requests, and mismatched
safe filename segments. Stream from disk rather than loading a 150 MiB file
fully into memory.

Tests must cover post/release validation, draft/publish rules, both slug conflict
paths, track reorder, audio-kind consistency, smartlink validation,
auth/origin enforcement, forged MIME, oversize rejection, traversal, private
draft media, public referenced media, GET/HEAD, valid/invalid byte ranges,
rollback cleanup, duration extraction, and an uploaded file URL round-trip.

**Verify**:

- `npm test -- src/lib/journal src/lib/music src/lib/media src/app/api/studio src/app/media`
  → all tests pass.
- Upload a small fixture PNG and MP3 through the API; their returned URLs answer
  200, and `curl -I -H 'Range: bytes=0-99' <audio-url>` answers 206 with
  `Content-Range` and `Content-Length: 100`.

### Step 4: Build the responsive writing and music studio

Create a separate author surface under `/studio`:

- `/studio` — separate Writing and Music lists, draft/published status, updated
  time, New post, and New release actions.
- `/studio/posts/new` — creates a draft immediately and redirects to its editor.
- `/studio/posts/[id]` — title, slug, excerpt, type, cover/alt, tags, Markdown
  editor, preview, save draft, publish/unpublish, and delete.
- `/studio/releases/new` — creates a release draft and redirects to its editor.
- `/studio/releases/[id]` — titles, slug, release type/date, Markdown
  description, cover/alt, smartlinks, ordered track editor, save,
  publish/unpublish, and delete.
- `/studio/media` — flat recent-media grid/list, upload drop zone, copy URL.

Use `@uiw/react-codemirror` only in a dynamically loaded client component.
Everything else should remain an RSC or small form client. Do not introduce a UI
kit. Scope new styles under `.studio-*` and echo the public site's paper, ink,
rules, mono typography, and quiet spacing. Studio chrome is English-only by
design; the public dictionaries remain listener-facing.

Note: `file-type` and `music-metadata` are ESM-only packages — import them with
ESM syntax; Next, Vitest, and `tsx` all handle this without configuration.

Editor behavior:

- Autosave a dirty draft after 1.5 seconds of inactivity and on explicit
  Cmd/Ctrl+S. Serialize saves so an older response cannot overwrite a newer edit.
- Show `saving`, `saved`, and actionable `failed` state; never claim success
  before the response.
- Warn before navigation only while unsaved content exists.
- Desktop: editor and preview side by side. Narrow screens: segmented
  Write/Preview controls, minimum 16px form text to avoid iOS zoom.
- Dragging an image uploads it and inserts `![alt text](/media/<id>/<name>)`.
- Dragging audio uploads it and inserts the safe custom Markdown directive
  `::audio[Optional title]{id="<media-uuid>"}`.
- The preview and public post must share `src/components/journal-markdown.tsx`.

Release-editor behavior:

- Add tracks with title/optional English title, lyrics Markdown, and audio mode.
- Attach a newly uploaded or existing MP3/M4A to a track; show detected duration
  and an authenticated preview before publication.
- Reorder tracks with accessible Move up/Move down controls. Do not add a
  drag-sort dependency in this plan.
- Preview the public release layout using the same release view model and
  Markdown renderer as the public page.
- Display validation errors beside the release or track field that blocks
  publication. Never discard an incomplete draft.
- Provide duu.to as the primary smartlink field and optional YouTube, Spotify,
  and Apple Music fields. Empty services are simply omitted publicly.
- Warn clearly that Publish makes attached audio publicly retrievable; require
  a confirmation on the first publish of a release containing full tracks.

Markdown safety/rendering:

- Use `react-markdown` + `remark-gfm` + a small local `remark-directive` plugin.
- Do not enable raw HTML (`rehype-raw` must not be installed).
- Only recognize the `audio` directive. Validate its UUID, resolve it through a
  media map loaded from DB, and render `JournalAudio`; unknown IDs render a
  quiet unavailable-media notice, not arbitrary markup.
- External links receive `rel="noreferrer noopener"`; disallow `javascript:`
  and non-HTTP(S)/mailto schemes.
- Preserve `.mdx-content` as the public wrapper class initially so the existing
  typography remains pixel-consistent despite the renderer change.

Add tests for Markdown sanitization, links, GFM, image rendering, valid audio,
unknown media, and raw HTML appearing as text/not executing.

**Verify**:

- `npm test -- src/components/journal-markdown src/components/studio` → pass.
- At 390×844 and desktop widths: create a post draft and a release draft, upload
  cover PNG and track MP3, attach/insert them, refresh, and confirm persisted
  editor/preview state.
- Keyboard-only: login, create/edit/save a post, create a release, add/reorder a
  track, publish, and copy a media URL with visible focus indicators.
- `npm run lint && npm run build` (run as separate commands if required by repo
  hooks) → both exit 0.

### Step 5: Add cached published-content queries and cache invalidation

Create `src/lib/journal/queries.ts` and `src/lib/music/queries.ts` with
server-only public view models. Wrap database reads with the installed Next
16-supported cache API after consulting its bundled docs:

- `listPublishedPosts(tagSlug?)`
- `getPublishedPost(slug)`
- `getAdjacentPublishedPosts(publishedAt, id)`
- `listPublishedTags()`
- `listPublishedReleases(type?)`
- `getLatestPublishedRelease()`
- `getPublishedRelease(slug)` including ordered tracks and resolved media
- `getAdjacentPublishedReleases(releaseDate, id)`

Requirements:

- Every public query includes `status = 'published'` and
  `published_at <= now`; never rely on the caller to filter drafts.
- Use separate `journal` and `music` cache tags plus deterministic
  keys/arguments and a one-hour fallback revalidation. The first request after
  invalidation may read SQLite; ordinary visitors should hit the cache.
- Request-level duplicate calls from `generateMetadata` and the page should be
  deduplicated using the Next/React API supported by this exact installed
  version.
- Return plain serializable view models, not Drizzle row objects.
- Calculate reading time automatically from Markdown text at 220 words/minute,
  minimum one minute; exclude fenced code URLs and directive syntax from the
  word count.
- Release view models derive track count and total duration from ordered track
  rows, falling back to imported `declared_*` values only when no rows exist.
  They expose cover alt, smartlinks, track audio URL/kind/duration, and lyrics
  without exposing disk paths or draft media.

After a transaction that changes a **published** post, its slug, tags, cover, or
publication state, invalidate the journal tag immediately and call
`revalidatePath` for:

- `/en|ja|mn/journal`
- the old and new `/en|ja|mn/journal/<slug>` paths when a slug changed
- `/feed.xml`
- `/sitemap.xml`

Draft-only autosaves must not repeatedly invalidate public content. Extract an
`invalidatePublishedJournalChange(before, after)` function and test the decision
matrix (draft→draft no; draft→published yes; published edit yes;
published→draft yes; slug change includes old/new paths).

After a transaction that changes a published release, its slug, cover,
smartlinks, track order/metadata/audio, or publication state, invalidate the
`music` tag and revalidate:

- `/en|ja|mn` because the home page shows the three newest releases
- `/en|ja|mn/music`
- old and new `/en|ja|mn/music/<slug>` paths
- the release OG route through its owning page path
- `/sitemap.xml`

Draft-only release/track autosaves do not invalidate public caches. Test the
same draft/published/slug transition matrix plus a published track edit.

**Verify**:

- `npm test -- src/lib/journal src/lib/music` → reading-time, published
  filtering, adjacent order, tag/type filtering, derived release totals, and
  both invalidation matrices pass.
- Instrument a test DB repository call count: two identical cached reads before
  invalidation cause one DB read; the first read after invalidation causes one
  additional DB read.

### Step 6: Switch every public consumer to the database

Update these exact consumers:

1. `src/app/[lang]/journal/page.tsx`
   - Await `listPublishedPosts(searchParams.tag)`.
   - Add an All/tags filter row with ordinary links (`?tag=<slug>`).
   - Preserve the current featured-first layout and card classes.
   - Handle zero results and an unknown tag without destructuring `undefined`.
   - Use real cover alt text.

2. `src/app/[lang]/journal/[slug]/page.tsx`
   - Remove `generateStaticParams`, `dynamicParams = false`, the MDX component,
     and `src/content/journal` imports.
   - Render `JournalMarkdown`, tags, auto reading time, and chronological
     previous/next links.
   - Both page and `generateMetadata` must use published-only cached lookup;
     drafts return 404 even when their slug is known.

3. `src/app/[lang]/journal/[slug]/opengraph-image.tsx`
   - Remove array/static-param usage; load the published post dynamically.
   - Keep the existing quiet `OgCard` visual. Add `export const runtime = "nodejs";` —
     SQLite cannot run at Edge, and the DB lookup requires it.

4. `src/app/feed.xml/route.ts`
   - Remove `force-static`; leave the route dynamic (it is cheap: cached
     queries, three items) so it is always current after invalidation.
     Do not add `revalidate` or caching headers beyond the existing XML type.
   - Keep English canonical post URLs and correct XML escaping.

5. `src/app/[lang]/music/page.tsx`
   - Replace `releases`, `featuredTracks`, and `releaseDetails` imports with
     cached queries. The latest published release drives the featured panel and
     its actual ordered tracks drive the track list.
   - Handle an empty catalog with a designed quiet empty state.
   - Keep `DiscographyFilter`, but pass serializable release-card view models.

6. `src/app/[lang]/music/[slug]/page.tsx`
   - Remove `generateStaticParams`, `dynamicParams = false`, and both handwritten
     content imports. Draft releases return 404.
   - Render cover, Markdown description, outbound duu.to/platform links,
     ordered playable tracks, per-track lyrics, and previous/next releases.
   - Add a client `ReleaseTrackPlayer` that owns one `<audio>` element so only
     one track plays at a time. It uses the media route's Range support,
     `preload="metadata"`, and visibly labels `preview` versus `full`.
   - Do not add autoplay, a global player, download buttons, or playback
     analytics.

7. `src/app/[lang]/music/[slug]/opengraph-image.tsx`
   - Load cached published release data dynamically and preserve `OgCard`.
   - Remove static params; add `export const runtime = "nodejs";` for the DB lookup.

8. `src/app/[lang]/page.tsx`, `src/components/release-card.tsx`, and
   `src/components/discography-filter.tsx`
   - Replace `typeof releases` coupling with an exported `ReleaseCardView`.
   - Await the three newest published releases on the home page.
   - Determine lyrics/playability from each view model instead of importing
     `releaseDetails` inside a presentation component.

9. `src/app/sitemap.ts`
   - Make it async and append every published journal and music slug for all
     three locale shells with real update/publication dates.
   - Verify in the bundled Next 16 docs whether `revalidatePath('/sitemap.xml')`
     applies to MetadataRoute output; if it does not, make the sitemap
     read-through dynamic instead so publish-without-deploy holds. Report which
     mechanism you landed on.

10. `src/messages/{en,ja,mn}.json` and `src/app/globals.css`
   - Add translated UI labels for All, filter-by-tag, previous, next, no posts,
     and media unavailable. Draft the Japanese and Mongolian text for later
     author correction.
   - Add music labels for preview/full, play/pause, smartlinks, previous/next
     release, and no releases. Draft Japanese and Mongolian for author review.
   - Add only tag-filter, adjacent-nav, empty-state, inline-media,
     release-player, smartlink, and scoped studio rules. Do not restyle existing
     journal/music cards, heroes, or type scale.

Tests/build checks must ensure RSS, sitemap, home, journal/music indexes, detail
metadata, OG, tag/type filters, and media access never expose a draft fixture.

**Verify**:

- `npm test` → all tests pass.
- `npm run build` → exit 0. Journal and music detail pages may be dynamic/cached;
  neither may remain a closed static-param set.
- A draft post and draft release return 404 from all locales and are absent from
  home/index HTML, RSS where applicable, sitemap, and OG routes. Their media
  returns 401 without a studio session.
- Publishing from `/studio` makes each detail/index/filter, sitemap, and OG
  route return current content without running a build; the post also updates
  RSS and the release updates the home-page music cards.

### Step 7: Migrate existing posts/releases and remove code-backed content

Create a Drizzle data migration whose `up` operation embeds the current three
Markdown bodies and metadata. It must:

- insert `bundled` media records pointing at the existing immutable cover URLs
  `/covers/rain-city.webp`, `/covers/glass-flowers.webp`, and
  `/covers/white-field.webp`;
- insert the three posts with their current slugs/dates/type/excerpts/body as
  `published`;
- create sensible initial tags (for example `release`, `process`, `site`) and
  join them explicitly;
- use deterministic IDs or guard by slug so rerunning cannot duplicate rows;
- provide a `down` migration that deletes only these known post/tag/media IDs.

The same migration must import all six releases from `src/content/site.ts` and
`src/content/release-details.ts`:

- create deterministic bundled media rows for the four existing covers and
  `public/audio/transparent-city-and-rain-preview.wav`;
- preserve every slug, original/English title, type, release date, description,
  cover, track count, and total duration;
- create the four known `transparent-city-and-rain` track rows in order and
  attach the preview WAV to track 1 with `audio_kind = 'preview'`;
- for the other five dummy releases, preserve their displayed counts/durations
  in `declared_*` fields and leave track rows empty rather than inventing track
  titles;
- mark the six imported releases published and use deterministic IDs/slug
  guards so reruns do not duplicate them;
- delete only the known imported release/track/media IDs in `down`.

Once the migration has rendered successfully through the DB-backed routes:

- delete `src/content/journal.ts` and all `src/content/posts/*.mdx`;
- delete `src/mdx.d.ts` and root `mdx-components.tsx` if `rg` confirms no other
  MDX consumer;
- remove `@mdx-js/loader`, `@mdx-js/react`, `@next/mdx`, and `@types/mdx`;
- remove `createMDX`, MDX `pageExtensions`, and `withMDX` from `next.config.ts`;
- delete `src/content/release-details.ts`;
- remove only `releases` and `featuredTracks` from `src/content/site.ts`; retain
  social links, projects, experience, and skills;
- run `rg -n 'journalPosts|getJournalPost|releaseDetails|featuredTracks|typeof releases|\.mdx|@next/mdx|@mdx-js' . --glob '!plans/**' --glob '!node_modules/**'`
  and require no active-code matches.

The historical SQL/data migration is allowed to contain the imported Markdown;
it is an immutable migration record, not a runtime source. Do not keep a JSON,
TypeScript, MDX, or handwritten release fallback array.

**Verify**:

- On an empty temporary DB, `npm run db:migrate` creates exactly 3 published
  posts and 6 published releases with unique slugs and valid cover relations.
- All three existing journal URLs render the same title, excerpt, body, cover,
  and date from the database.
- All six existing music URLs retain their title/date/count/duration/cover and
  description; the first release retains its four-track list and preview.
- The `rg` command above returns no active-code matches.
- `npm test`, `npm run lint`, and `npm run build` all pass.

### Step 8: Add terminal drafting and day-one backup/restore operations

Create `scripts/content/new-post.ts` so:

```bash
npm run post:new -- --title "A note from tonight"
```

creates a draft using the repository layer, generates a unique slug, and prints
only the ID and `/studio/posts/<id>` URL. It must refuse to run if the configured
DB does not exist and must not bypass schema validation.

Create the parallel `scripts/content/new-release.ts` so:

```bash
npm run release:new -- --title "夜明け前" --english-title "Before dawn"
```

creates an incomplete release draft and prints only its ID and
`/studio/releases/<id>` URL. It must use the music repository and the same DB
existence/schema guards.

Create `scripts/backup/content-backup.sh`:

- require explicit `CONTENT_DATABASE_PATH`, `CONTENT_UPLOADS_PATH`, and
  `CONTENT_BACKUP_PATH` values;
- reject `/`, `$HOME`, the repo root, missing/relative production targets, or a
  backup destination inside the uploads directory;
- use `sqlite3 <db> ".backup '<timestamped-temp-db>'"` for a consistent backup
  while WAL is active;
- archive the uploads directory, write SHA-256 checksums and a manifest, then
  atomically rename the completed timestamp directory;
- never delete old backups automatically.

Create `scripts/backup/restore-check.sh` which restores into `mktemp -d`, verifies
checksums, extracts uploads, runs SQLite `PRAGMA integrity_check`, and asserts
that `journal_posts` and `media` are readable. It must never write to the live DB
or live upload directory.

Document in `docs/content-operations.md` and `README.md`:

- environment provisioning and password-hash generation;
- writable `data/` ownership for the Node service user;
- migration-before-start deployment order;
- HTTPS requirement for `/studio` and reverse-proxy upload limit ≥150 MiB;
- daily local backup plus encrypted offsite copy; SQLite DB and uploads must be
  captured in the same run;
- monthly restore-check command;
- post and release publish/unpublish workflows, audio visibility, and how each
  cache tag is invalidated;
- how to rotate the password/session secret (rotation logs out existing sessions).

Update `.gitignore` to include `data/content.sqlite*`, `data/uploads/`, and the
local backup directory while retaining existing `/data/*.ndjson` rules.

**Verify**:

- `npm run post:new -- --title "Backup smoke draft"` creates one draft.
- `npm run release:new -- --title "試験" --english-title "Backup smoke release"`
  creates one release draft.
- `npm run content:backup` creates a timestamped DB, uploads archive, manifest,
  and checksums.
- `npm run content:restore-check -- <backup-directory>` exits 0 and reports
  `integrity_check=ok` plus readable post/release/track/media counts.
- Delete both smoke drafts through the studio after verification.

### Step 9: Perform the release gate

On a production-like local copy (not the live DB):

1. Run migrations twice; second run is a no-op.
2. Restore a backup and pass the restore check.
3. Login on desktop and a phone-size viewport.
4. Create both a post draft and music-release draft in under 30 seconds each.
5. Upload a cover PNG and track MP3 by drag/drop; add two tracks, attach audio,
   add lyrics, reorder them, and copy both media URLs.
6. Without the studio cookie, confirm both drafts are absent from public pages,
   direct routes, RSS where applicable, sitemap, and OG routes; draft media
   must return 401.
7. Publish the post and release once. Confirm all public consumers update
   without `next build` or a process restart; home/music/detail show the release
   and the audio plays through byte-range requests.
8. Filter the post by tag, the release by type, and traverse both previous/next
   navigations.
9. Unpublish both and confirm their routes return 404, listings disappear, and
   media that has no other published reference becomes private again.
10. Restart the Node process and confirm posts, releases, track order, smartlinks,
    and media persist.

**Verify**:

- `npm test` → all pass.
- `npm run lint` → exit 0.
- `npm run build` → exit 0.
- `git status --short` contains only the files in this plan's in-scope list and
  no SQLite DB, WAL/SHM file, upload, backup, or secret `.env` file.

## Test plan

Use Vitest with temporary directories and temporary SQLite databases. Tests may
not read or modify the developer's `data/` directory. At minimum cover:

- schema constraints, migrations, repository transactions, tag and track sync;
- every public query excluding draft/future posts and releases;
- reading time, release totals, and chronological adjacent selection;
- password/session/origin/auth failures;
- post/release/track validation, reorder, and publish requirements;
- file signature/size/path validation, audio metadata, range responses,
  draft/public media authorization, and rollback cleanup;
- Markdown sanitization and the audio directive;
- both cache invalidation decision matrices;
- migrated post/release/track content and absence of drafts from public
  pages/RSS/sitemap/metadata.

Tests involving timers use a fixed clock. Tests involving UUIDs inject a stable
generator. Tests involving filesystem paths use `mkdtemp`; no broad cleanup path
is permitted.

## Done criteria

- [ ] A browser user can create a post or release draft in under 30 seconds.
- [ ] Cover and MP3/M4A uploads return usable URLs and survive a process restart.
- [ ] Post/release drafts and their media are absent from every public surface;
      publish/unpublish updates all consumers without a build or restart.
- [ ] Journal and music index/detail pages preserve the existing quiet design.
- [ ] Tags, previous/next, reading time, RSS, per-post sitemap entries, and OG
      metadata/images work from DB content.
- [ ] Release publishing supports metadata, covers, ordered tracks, detected
      duration, preview/full audio, lyrics, and duu.to/platform links.
- [ ] Music pages, home cards, dynamic OG, and sitemap use published DB releases.
- [ ] Exactly one runtime source remains for posts and releases: SQLite. MDX,
      handwritten journal registration, release arrays/details are gone.
- [ ] Public journal/music reads are separately cached and correctly invalidated.
- [ ] Studio mutations require a valid signed session and same-site Origin.
- [ ] Upload validation is byte-based, bounded, traversal-safe, and streamed.
- [ ] SQLite plus uploads have a successful backup and isolated restore check.
- [ ] `npm test`, `npm run lint`, and `npm run build` all exit 0.
- [ ] Existing message-wall and subscriber routes are unchanged.
- [ ] No data, uploads, backups, or secrets are tracked by git.
- [ ] `plans/README.md` marks plan 010 DONE after execution.

## STOP conditions

Stop and report; do not improvise if:

- Current journal/music source excerpts no longer match the working tree.
- Implementation appears to require Payload, another CMS, hosted auth, hosted
  storage, serverless infrastructure, or a second database.
- `better-sqlite3` is incompatible with the VPS Node runtime or cannot be
  bundled/externalized under the installed Next 16 version. Report the exact
  build/runtime error before proposing a different SQLite driver.
- A safe streaming upload or byte-range response cannot be implemented within
  Next route handlers without buffering the whole file.
- The real reverse proxy cannot accept the agreed maximum audio size.
- Existing production post/release content exists outside the three MDX posts,
  six release entries, and one preview described here; migration must be
  re-scoped before deleting anything.
- The intended meaning of “publish music” includes delivering to external DSPs
  rather than publishing playable releases on this website. Distribution is a
  separate product/integration and must not be inferred into this plan.
- A migration or restore check points at the live production DB/uploads.
- A verification command fails twice after a reasonable focused fix.
- Completing a step would touch the NDJSON message/subscriber system or another
  out-of-scope subsystem.

## Maintenance notes

- Back up `content.sqlite` and `uploads/` together. Restoring only one can leave
  broken media references.
- WAL produces `-wal` and `-shm` files during runtime; the SQLite `.backup`
  command is required instead of copying a live DB file naively.
- Keep raw HTML disabled. If richer embeds are needed, add one narrowly parsed
  directive and renderer at a time.
- Do not add roles or a users table until a second real author exists.
- A future CDN/S3 migration should preserve `media.id` and rewrite the storage
  adapter/public URL, not rewrite Markdown bodies.
- This plan serves upload-ready MP3/M4A and does not transcode masters. If the
  author later wants WAV/FLAC ingestion, add a queued transcoding pipeline with
  explicit resource limits rather than doing FFmpeg work in a request handler.
- Once audio has been publicly served it may remain in a listener's browser or
  intermediary cache after unpublishing. Unpublish prevents future authorized
  origin access; it cannot revoke already downloaded files.
- The message wall and subscribers intentionally remain NDJSON; consolidation
  is a separate future decision.
- Reviewers should scrutinize auth cookie/origin enforcement, file path
  containment, draft-media authorization, byte-range arithmetic, track reorder
  transactions, cache invalidation on slug/status/audio changes, and backup
  restore isolation more heavily than studio cosmetics.
