import { pool } from "../client";
import { repairGridQuoteLifecycle } from "../../lib/data/grid-quote-repair";

try {
  const counts = await repairGridQuoteLifecycle();
  process.stdout.write(`${JSON.stringify(counts)}\n`);
} finally {
  await pool.end();
}
