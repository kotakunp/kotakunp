# kotakunp

A blog and music archive. English, Japanese, and Mongolian interface text lives
in `src/messages`. Article bodies are written in English.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root redirects to
`/en`; `/ja` and `/mn` contain the other language drafts.

Set `NEXT_PUBLIC_SITE_URL` to the production origin before deployment so the
sitemap and social metadata use the correct URL.

## Writing a post

Journal posts are plain TypeScript. Add a post by appending an entry to the
`POSTS` array in `src/content/journal.ts` — no database, no build step, no admin
UI. Markdown body, GFM supported, cover images are static files in
`public/covers/`.

See `docs/content-operations.md` for the full field list.

## Discography

The **discography** is served from SQLite (`data/content.sqlite`) managed through
`/studio`. It must be migrated before the app will boot:

```sh
npm run db:migrate
```

See `docs/content-operations.md` for provisioning, backups, restore drills, and
the music publishing workflow.

## Public message wall

The reach-out wall stores messages in `data/reach-out.ndjson`. A serverless
filesystem such as Vercel's is ephemeral, so replace the route's file storage
with a durable database before a serverless launch. Public posting also needs
moderation before the site is widely shared.

## Documentation

| Document | Content |
|---|---|
| [`docs/application.md`](docs/application.md) | How the application works. Architecture, routing, storage, access control, and procedures. Written to ASD-STE100. |
| [`docs/content-operations.md`](docs/content-operations.md) | Day-to-day content tasks. Adding posts, publishing music, backups. |
| [`plans/`](plans/) | Historical implementation plans. All complete. |