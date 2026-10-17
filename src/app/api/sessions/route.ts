import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { isUuid, isSessionDate } from "@/lib/desktop-sync";

import { validateDeletion } from "@/lib/history-deletion";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const { anesthetistName, date, clientGeneratedId } = body;

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
      if (existing?.deletedAt) return NextResponse.json({ id: existing.id, deleted: true });
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
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    console.error("POST /api/sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const allSessions = await getDb()
      .select()
      .from(sessions)
      .where(isNull(sessions.deletedAt))
      .orderBy(desc(sessions.date));

    return NextResponse.json(allSessions, { headers: { "X-OR-Timer-Desktop-Sync": "1", "X-OR-Timer-Deletion": "1" } });
  } catch (error) {
    console.error("GET /api/sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const error = validateDeletion(body, "day");
    if (error) return NextResponse.json({ error }, { status: 400 });
    // One atomic update covers every anesthetist's session on this date.
    await getDb().update(sessions).set({ deletedAt: new Date() })
      .where(and(eq(sessions.date, body.date), isNull(sessions.deletedAt)));
    return NextResponse.json({ deleted: true, date: body.date });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    console.error("DELETE /api/sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
