import "dotenv/config";

/**
 * Drizzle DB connection for Neon Serverless.
 *
 * This file exports a configured `db` instance used by:
 * - Better-Auth Drizzle adapter
 * - All route handlers (read/write)
 * - The seed script
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql);
