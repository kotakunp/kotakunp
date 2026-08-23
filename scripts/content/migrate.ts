import process from "node:process";
import { migrateContentDatabaseFromEnvironment } from "../../src/db/migrate";

try {
  const { applied, totalApplied, databasePath } = migrateContentDatabaseFromEnvironment();
  if (applied === 0) {
    console.log(`Content database already up to date (${totalApplied} migration(s) on record) at ${databasePath}`);
  } else {
    console.log(`Applied ${applied} migration(s) to ${databasePath} (${totalApplied} on record)`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
