# Content operations

Day-to-day operation of the SQLite-backed publishing backend (`/studio`).

Scope: the studio backs **music** (releases, tracks, audio) only. **Journal
posts are not in the database** — see [Journal posts](#journal-posts) below.

## Journal posts

Journal posts are plain TypeScript in `src/content/journal.ts`. There is no
database, no studio, and no publish step.

To add one, append an entry to the `POSTS` array:

```ts
{
  slug: "some-slug",                 // must be unique
  title: "Some title",
  excerpt: "One sentence for cards, RSS, and meta descriptions.",
  type: "studio note",               // the small label on the card
  coverPath: "/covers/some-image.webp",  // file in public/, or null
  coverAlt: "Describe the cover for screen readers",
  publishedAt: "2026-06-01",         // ISO date; drives ordering
  tags: [{ name: "process", slug: "process" }],
  bodyMarkdown: `# Heading

Markdown, GFM supported.`,
}
```

- Ordering is derived from `publishedAt` at read time, so position in the array
  does not matter. The newest post becomes the featured card.
- Cover images are static files in `public/covers/`. There is no upload step.
- There are no drafts. A post is public the moment it is in the file. Delete the
  entry to unpublish.
- Reading time is computed from the body automatically.
- The `::audio[label]{id="..."}` directive needs the database media table. The
  renderer does not support this directive for a journal post.

## Music provisioning

The rest of this document covers `/studio`, which manages music only.

1. Copy `.env.example` values into your environment. Generate the password hash:

   ```sh
   printf 'your-password' | npx tsx scripts/content/hash-password.ts
   # prints STUDIO_PASSWORD_SALT and STUDIO_PASSWORD_HASH
   ```

2. Set `CONTENT_DATABASE_PATH` (absolute path) and `CONTENT_UPLOADS_PATH`.
3. Run `npm run db:migrate` before starting the app (creates + migrates `data/content.sqlite`).
4. The Node service user needs **write access** to `data/`.

### Deployment order

migrate → start. Never start against a missing database; the runtime client refuses to create one.

### Security

- `/studio` and `/api/studio/**` require HTTPS in production (`__Host-` cookie is `Secure`).
- Configure the reverse proxy to allow request bodies ≥ 150 MiB for `/api/studio/media`.
- Rotate the password by regenerating salt/hash and restarting. Rotating `STUDIO_SESSION_SECRET` logs out all sessions.

### Publishing music

- Releases are created from `/studio` (or `npm run release:new`).
- Attached audio becomes publicly retrievable once its release is published.
  Unpublishing blocks future access but cannot recall downloaded files.
- Publishing/unpublishing invalidates the `music` cache tag; public pages update
  without a rebuild.

### Backups

Covers the database (music) and uploaded media only. Journal posts are tracked
in git and need no backup.

```sh
CONTENT_DATABASE_PATH=/abs/path/content.sqlite \
CONTENT_UPLOADS_PATH=/abs/path/uploads \
CONTENT_BACKUP_PATH=/abs/path/backups \
npm run content:backup
```

- Uses `sqlite3 .backup` (consistent under WAL), archives uploads, writes SHA256SUMS + manifest.
- Run daily (cron) and copy the timestamped directory offsite encrypted.
- Old backups are never deleted automatically.

### Restore drill (monthly)

```sh
bash scripts/backup/restore-check.sh /abs/path/backups/<timestamp>
```

Verifies checksums, SQLite integrity, and row counts inside a temp dir. Never touches live paths.

## Cache tags

| Tag | Invalidated by | Feeds |
|---|---|---|
| `music` | published release/track changes | home cards, music index/detail, OG, sitemap |

The `music` tag is the only cache tag in the application. Journal pages do not
use a cache tag.
