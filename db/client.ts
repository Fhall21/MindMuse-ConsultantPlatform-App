import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getDatabaseUrl } from "../lib/env";
import * as schema from "./schema";

declare global {
  var __consultantPlatformDbPool: Pool | undefined;
}

function createPool() {
  return new Pool({
    connectionString: getDatabaseUrl(),
  });
}

const pool = globalThis.__consultantPlatformDbPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__consultantPlatformDbPool = pool;
}

export const db = drizzle(pool, { schema });

export type AppDatabase = typeof db;
