import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export async function acquireSessionLock(sessionId: string): Promise<boolean> {
  const result = await db.execute<{ locked: boolean }>(
    sql`SELECT pg_try_advisory_lock(hashtext(${sessionId})) AS locked`
  );
  const row = result.rows[0];
  return Boolean(row?.locked);
}

export async function releaseSessionLock(sessionId: string): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(hashtext(${sessionId}))`);
}
