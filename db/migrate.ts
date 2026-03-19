import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./client";

async function run() {
  await migrate(db, {
    migrationsFolder: "./drizzle",
  });
  process.stdout.write("Drizzle migrations applied successfully.\n");
}

function formatError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const details: string[] = [error.stack ?? error.message];
  const cause = (error as Error & { cause?: unknown }).cause;

  if (cause && typeof cause === "object") {
    const databaseError = cause as {
      code?: string;
      detail?: string;
      hint?: string;
      message?: string;
      schema?: string;
      table?: string;
    };

    if (databaseError.message) details.push(`cause: ${databaseError.message}`);
    if (databaseError.code) details.push(`code: ${databaseError.code}`);
    if (databaseError.detail) details.push(`detail: ${databaseError.detail}`);
    if (databaseError.hint) details.push(`hint: ${databaseError.hint}`);
    if (databaseError.schema) details.push(`schema: ${databaseError.schema}`);
    if (databaseError.table) details.push(`table: ${databaseError.table}`);
  }

  return details.join("\n");
}

run().catch((error) => {
  process.stderr.write(`${formatError(error)}\n`);
  process.exit(1);
});
