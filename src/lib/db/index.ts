import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

export function getDb() {
  const sql = neon(process.env.POSTGRES_URL!);
  return drizzle(sql, { schema });
}
