# kotakunp

A multilingual music and artist website built with Next.js. English, Japanese,
and Mongolian copy lives in `src/messages` so it can be edited without touching
the page components.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root redirects to
`/en`; `/ja` and `/mn` contain the other language drafts.

Set `NEXT_PUBLIC_SITE_URL` to the production origin before deployment so the
sitemap and social metadata use the correct URL.

## Public message wall

The reach-out wall is functional in a persistent Node.js deployment and stores
messages in `data/reach-out.ndjson`. A serverless filesystem such as Vercel's is
ephemeral, so replace the route's file storage with a durable database before a
serverless launch. Public posting also needs moderation and stronger rate
limiting before the site is widely shared.

## Content backend

The journal and discography are served from SQLite (`data/content.sqlite`) managed through `/studio`.
See `docs/content-operations.md` for provisioning, backups, restore drills, and the publish workflow.
