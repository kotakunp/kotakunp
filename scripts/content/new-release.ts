import fs from "node:fs";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { getContentDatabasePath, openContentDatabase } from "../../src/db/client";
import * as schema from "../../src/db/schema";
import { MusicRepository } from "../../src/lib/music/repository";

const MAX_TITLE_LENGTH = 160;

function fail(message: string): never {
  console.error(message);
  console.error(
    'Usage: npm run release:new -- --title "<release title>" [--english-title "<english title>"]',
  );
  process.exit(1);
}

function parseArguments(argv: readonly string[]): {
  title: string;
  englishTitle?: string;
} {
  let title: string | null = null;
  let englishTitle: string | null = null;
  const readValue = (flag: string, index: number): string => {
    if (index >= argv.length) fail(`The ${flag} argument requires a value.`);
    return argv[index];
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consume = (current: string | null, flag: string): string | null => {
      if (current !== null) fail(`Duplicate ${flag} argument.`);
      if (argument === flag) {
        index += 1;
        return readValue(flag, index);
      }
      return argument.slice(`${flag}=`.length);
    };
    if (argument === "--title" || argument.startsWith("--title=")) {
      title = consume(title, "--title");
      continue;
    }
    if (argument === "--english-title" || argument.startsWith("--english-title=")) {
      englishTitle = consume(englishTitle, "--english-title");
      continue;
    }
    fail(`Unknown argument: ${argument}`);
  }
  const trimmedTitle = title?.trim() ?? "";
  if (!trimmedTitle) fail("A non-empty --title is required.");
  if (trimmedTitle.length > MAX_TITLE_LENGTH) {
    fail(`The --title must be at most ${MAX_TITLE_LENGTH} characters.`);
  }
  const trimmedEnglishTitle = englishTitle?.trim() ?? "";
  if (trimmedEnglishTitle.length > MAX_TITLE_LENGTH) {
    fail(`The --english-title must be at most ${MAX_TITLE_LENGTH} characters.`);
  }
  return {
    title: trimmedTitle,
    englishTitle: trimmedEnglishTitle || undefined,
  };
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
  repository: MusicRepository,
  title: string,
): Promise<string> {
  const base = slugify(title) || `release-${utcDateStamp(new Date())}`;
  let candidate = base;
  for (let counter = 2; counter <= 100; counter += 1) {
    if ((await repository.getReleaseBySlug(candidate)) === null) return candidate;
    candidate = `${base}-${counter}`;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

async function main(): Promise<void> {
  const { title, englishTitle } = parseArguments(process.argv.slice(2));
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
    const repository = new MusicRepository(drizzle(sqlite, { schema }));
    const row = await repository.createRelease({
      slug: await generateUniqueSlug(repository, title),
      title,
      englishTitle,
      status: "draft",
    });
    console.log(row.id);
    console.log(`/studio/releases/${row.id}`);
  } finally {
    sqlite.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
