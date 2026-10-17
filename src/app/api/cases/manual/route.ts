import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, max } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { cases, sessions } from "@/lib/db/schema";
import { isUuid } from "@/lib/desktop-sync";
import { durationSeconds, timeFields, validateTimes, type CaseTimes } from "@/lib/case-times";

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || !isUuid(body.id) || !isUuid(body.sessionId)) return NextResponse.json({ error: "Invalid case or session ID" }, { status: 400 });
    const validationError = validateTimes(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    if (timeFields.every(field => body[field] === null)) return NextResponse.json({ error: "Enter at least one timestamp" }, { status: 400 });
    const db = getDb();
    const [parent] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, body.sessionId), isNull(sessions.deletedAt)));
    if (!parent) return NextResponse.json({ error: "Day not found or deleted" }, { status: 404 });
    const [last] = await db.select({ number: max(cases.caseNumber) }).from(cases).where(eq(cases.sessionId, body.sessionId));
    const times = body as CaseTimes;
    const endpoints = Object.fromEntries(timeFields.map(field => [field, times[field] === null ? null : new Date(times[field]!)]));
    const [inserted] = await db.insert(cases).values({
      id: body.id, sessionId: body.sessionId, caseNumber: (last?.number ?? 0) + 1,
      ...endpoints, ...durationSeconds(times), lockedTimes: [...timeFields],
    }).onConflictDoNothing({ target: cases.id }).returning();
    if (inserted) return NextResponse.json(inserted, { status: 201 });
    const [existing] = await db.select().from(cases).where(eq(cases.id, body.id));
    if (!existing || existing.deletedAt || existing.sessionId !== body.sessionId) return NextResponse.json({ error: "Case ID conflicts with existing history" }, { status: 409 });
    return NextResponse.json(existing);
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    console.error("POST /api/cases/manual error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
