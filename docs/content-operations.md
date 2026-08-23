# Content operations

Day-to-day operation of the SQLite-backed publishing backend (`/studio`).

## Provisioning

1. Copy `.env.example` values into your environment. Generate the password hash:

   ```sh
   printf 'your-password' | npx tsx scripts/content/hash-password.ts
   # prints STUDIO_PASSWORD_SALT and STUDIO_PASSWORD_HASH
   ```

2. Set `CONTENT_DATABASE_PATH` (absolute path) and `CONTENT_UPLOADS_PATH`.
3. Run `npm run db:migrate` before starting the app (creates + migrates `data/content.sqlite`).
4. The Node service user needs **write access** to `data/`.

## Deployment order

migrate → start. Never start against a missing database; the runtime client refuses to create one.

## Security

- `/studio` and `/api/studio/**` require HTTPS in production (`__Host-` cookie is `Secure`).
- Configure the reverse proxy to allow request bodies ≥ 150 MiB for `/api/studio/media`.
- Rotate the password by regenerating salt/hash and restarting. Rotating `STUDIO_SESSION_SECRET` logs out all sessions.

## Backups

```sh
CONTENT_DATABASE_PATH=/abs/path/content.sqlite \
CONTENT_UPLOADS_PATH=/abs/path/uploads \
CONTENT_BACKUP_PATH=/abs/path/backups \
npm run content:backup
```

- Uses `sqlite3 .backup` (consistent under WAL), archives uploads, writes SHA256SUMS + manifest.
- Run daily (cron) and copy the timestamped directory offsite encrypted.
- Old backups are never deleted automatically.

## Restore drill (monthly)

```sh
bash scripts/backup/restore-check.sh /abs/path/backups/<timestamp>
```

Verifies checksums, SQLite integrity, and row counts inside a temp dir. Never touches live paths.

## Publishing workflow

- Drafts are created from `/studio` (or `npm run post:new -- --title "..."`).
- Publish requires: title, slug, excerpt, type, body, cover (+alt), ≥1 tag.
- Publishing/unpublishing invalidates the journal/music cache tags immediately; public pages update without a rebuild.
- Attached audio becomes publicly retrievable once its release is published. Unpublishing blocks future access but cannot recall downloaded files.

## Cache tags

| Tag | Invalidated by | Feeds |
|---|---|---|
| `journal` | published post create/edit/publish/delete | journal index/detail, RSS, sitemap |
| `music` | published release/track changes | home cards, music index/detail, OG, sitemap |
