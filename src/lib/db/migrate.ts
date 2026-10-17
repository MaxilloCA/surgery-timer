import { neon } from "@neondatabase/serverless";

async function migrate() {
  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!url) throw new Error("Database URL missing");
  const sql = neon(url);
  console.log("Running migrations...");
  
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      date DATE NOT NULL,
      anesthetist_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cases (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
      case_number INTEGER NOT NULL,
      surgery_start TIMESTAMPTZ NOT NULL,
      surgery_end TIMESTAMPTZ,
      surgery_duration_sec INTEGER,
      turnover_start TIMESTAMPTZ,
      turnover_end TIMESTAMPTZ,
      turnover_duration_sec INTEGER,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  `;

  await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
  await sql`ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;

  await sql`ALTER TABLE cases ALTER COLUMN surgery_start DROP NOT NULL`;
  await sql`ALTER TABLE cases ADD COLUMN IF NOT EXISTS locked_times TEXT[] NOT NULL DEFAULT '{}'`;

  console.log("Migrations complete.");
}

migrate().catch(() => {
  console.error("Migration failed. Verify database connectivity and migration permissions.");
  process.exit(1);
});
