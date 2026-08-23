import fs from "node:fs";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { getContentDatabasePath, openContentDatabase } from "../../src/db/client";
import * as schema from "../../src/db/schema";
import { JournalRepository } from "../../src/lib/journal/repository";

const MAX_TITLE_LENGTH = 160;

function fail(message: string): never {
  console.error(message);
  console.error('Usage: npm run post:new -- --title "<post title>"');
  process.exit(1);
}

function parseTitle(argv: readonly string[]): string {
  let title: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--title" || argument.startsWith("--title=")) {
      if (title !== null) fail("Duplicate --title argument.");
      if (argument === "--title") {
        index += 1;
        if (index >= argv.length) fail("The --title argument requires a value.");
        title = argv[index];
      } else {
        title = argument.slice("--title=".length);
      }
      continue;
    }
    fail(`Unknown argument: ${argument}`);
  }
  const trimmed = title?.trim() ?? "";
  if (!trimmed) fail("A non-empty --title is required.");
  if (trimmed.length > MAX_TITLE_LENGTH) {
    fail(`The --title must be at most ${MAX_TITLE_LENGTH} characters.`);
  }
  return trimmed;
}

function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function utcDateStamp(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}${month}${day}`;
}

/** Server-side slug generation with uniqueness guaranteed through the repository. */
async function generateUniqueSlug(
  repository: JournalRepository,
  title: string,
): Promise<string> {
  const base = slugify(title) || `post-${utcDateStamp(new Date())}`;
  let candidate = base;
  for (let counter = 2; counter <= 100; counter += 1) {
    if ((await repository.getPostBySlug(candidate)) === null) return candidate;
    candidate = `${base}-${counter}`;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

async function main(): Promise<void> {
  const title = parseTitle(process.argv.slice(2));
  const databasePath = getContentDatabasePath();
  if (!fs.existsSync(databasePath)) {
    console.error(`Refusing to run: content database not found at ${databasePath}.`);
    console.error(
      "Run `npm run db:migrate` against the configured CONTENT_DATABASE_PATH first.",
    );
    process.exit(1);
  }
  const sqlite = openContentDatabase(databasePath);
  try {
    const repository = new JournalRepository(drizzle(sqlite, { schema }));
    const row = await repository.createPost({
      slug: await generateUniqueSlug(repository, title),
      title,
      status: "draft",
    });
    console.log(row.id);
    console.log(`/studio/posts/${row.id}`);
  } finally {
    sqlite.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
