import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { isUuid, isSessionDate } from "@/lib/desktop-sync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { anesthetistName, date, clientGeneratedId } = await req.json();

    if (!anesthetistName || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (clientGeneratedId !== undefined) {
      if (!isUuid(clientGeneratedId) || !isSessionDate(date) || typeof anesthetistName !== "string" || !anesthetistName.trim()) {
        return NextResponse.json({ error: "Invalid desktop session" }, { status: 400 });
      }
      const db = getDb();
      const [inserted] = await db.insert(sessions)
        .values({ id: clientGeneratedId, anesthetistName, date })
        .onConflictDoNothing({ target: sessions.id }).returning();
      if (inserted) return NextResponse.json(inserted, { status: 201 });
      const [existing] = await db.select().from(sessions).where(eq(sessions.id, clientGeneratedId));
      if (!existing || existing.date !== date || existing.anesthetistName !== anesthetistName) {
        return NextResponse.json({ error: "Session ID conflicts with existing history" }, { status: 409 });
      }
      return NextResponse.json(existing);
    }

    const [session] = await getDb()
      .insert(sessions)
      .values({ anesthetistName, date })
      .returning();

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const allSessions = await getDb()
      .select()
      .from(sessions)
      .orderBy(desc(sessions.date));

    return NextResponse.json(allSessions, { headers: { "X-OR-Timer-Desktop-Sync": "1" } });
  } catch (error) {
    console.error("GET /api/sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
