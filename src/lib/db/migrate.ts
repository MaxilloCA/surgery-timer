import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.POSTGRES_URL!);

async function migrate() {
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

  console.log("Migrations complete.");
}

migrate().catch(console.error);
