import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./client";

async function run() {
  await migrate(db, {
    migrationsFolder: "./drizzle",
  });
  process.stdout.write("Drizzle migrations applied successfully.\n");
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
