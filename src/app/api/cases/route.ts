import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cases } from "@/lib/db/schema";
import { eq, asc, and, isNull, sql } from "drizzle-orm";
import { isUuid, validateDesktopCase } from "@/lib/desktop-sync";
import { CaseTimes, durationSeconds, timeFields, timerMerge, validTimestamp, validateCorrection } from "@/lib/case-times";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      sessionId,
      caseNumber,
      surgeryStart,
      surgeryEnd,
      surgeryDurationSec,
      turnoverStart,
      turnoverEnd,
      turnoverDurationSec,
      notes,
    } = body;

    if (!sessionId || !caseNumber || !surgeryStart) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (body.clientGeneratedId !== undefined) {
      const validationError = validateDesktopCase(body);
      if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
      const merge = timerMerge({
        surgeryEnd: sql`excluded.surgery_end`,
        turnoverStart: sql`excluded.turnover_start`,
        turnoverEnd: sql`excluded.turnover_end`,
      });
      // Completion is monotonic: delayed retries cannot clear a completed interval.
      // Notes are only inserted here, preserving any later edits made on the website.
      const [synced] = await getDb().insert(cases).values({
        id: body.clientGeneratedId, sessionId, caseNumber,
        surgeryStart: new Date(surgeryStart),
        surgeryEnd: surgeryEnd ? new Date(surgeryEnd) : null,
        surgeryDurationSec: durationSeconds({ surgeryStart, surgeryEnd: surgeryEnd ?? null, turnoverStart: turnoverStart ?? null, turnoverEnd: turnoverEnd ?? null }).surgeryDurationSec,
        turnoverStart: turnoverStart ? new Date(turnoverStart) : null,
        turnoverEnd: turnoverEnd ? new Date(turnoverEnd) : null,
        turnoverDurationSec: durationSeconds({ surgeryStart, surgeryEnd: surgeryEnd ?? null, turnoverStart: turnoverStart ?? null, turnoverEnd: turnoverEnd ?? null }).turnoverDurationSec,
        notes: notes ?? null,
      }).onConflictDoUpdate({
        target: cases.id,
        set: merge.set,
        setWhere: and(eq(cases.sessionId, sessionId), eq(cases.caseNumber, caseNumber), merge.valid),
      }).returning();
      if (!synced) return NextResponse.json({ error: "Case ID conflicts with existing history" }, { status: 409 });
      return NextResponse.json(synced);
    }

    // Upsert — if id provided, update; otherwise insert
    if (id) {
      if (!isUuid(id)) return NextResponse.json({ error: "Invalid case ID" }, { status: 400 });
      for (const value of [surgeryEnd, turnoverStart, turnoverEnd]) {
        if (value != null && !validTimestamp(value)) return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
      }
      if (notes != null && typeof notes !== "string") return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
      const timestamp = (value: string | null | undefined) => sql`${value == null ? null : new Date(value).toISOString()}::timestamp`;
      const merge = timerMerge({ surgeryEnd: timestamp(surgeryEnd), turnoverStart: timestamp(turnoverStart), turnoverEnd: timestamp(turnoverEnd) });
      // The browser sends an epoch placeholder for surgeryStart during updates.
      const [updated] = await getDb().update(cases).set({ ...merge.set, notes })
        .where(and(eq(cases.id, id), merge.valid)).returning();
      if (!updated) {
        const [existing] = await getDb().select({ id: cases.id }).from(cases).where(eq(cases.id, id));
        return NextResponse.json({ error: existing ? "Timer update conflicts with corrected times" : "Case not found" }, { status: existing ? 409 : 404 });
      }
      return NextResponse.json(updated);
    }

    const [inserted] = await getDb()
      .insert(cases)
      .values({
        sessionId,
        caseNumber,
        surgeryStart: new Date(surgeryStart),
        surgeryEnd: surgeryEnd ? new Date(surgeryEnd) : undefined,
        surgeryDurationSec,
        turnoverStart: turnoverStart ? new Date(turnoverStart) : undefined,
        turnoverEnd: turnoverEnd ? new Date(turnoverEnd) : undefined,
        turnoverDurationSec,
        notes,
      })
      .returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error("POST /api/cases error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const result = await getDb()
      .select()
      .from(cases)
      .where(eq(cases.sessionId, sessionId))
      .orderBy(asc(cases.caseNumber));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/cases error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const error = validateCorrection(body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const original = body.original as CaseTimes;
    const times = body as CaseTimes;
    const [updated] = await getDb().update(cases).set({
      surgeryStart: new Date(times.surgeryStart!),
      surgeryEnd: new Date(times.surgeryEnd!),
      turnoverStart: times.turnoverStart === null ? null : new Date(times.turnoverStart),
      turnoverEnd: times.turnoverEnd === null ? null : new Date(times.turnoverEnd),
      ...durationSeconds(times),
    }).where(and(eq(cases.id, body.id), ...timeFields.map(field =>
      original[field] === null ? isNull(cases[field]) : eq(cases[field], new Date(original[field]!))
    ))).returning();
    if (!updated) {
      const [existing] = await getDb().select({ id: cases.id }).from(cases).where(eq(cases.id, body.id));
      return NextResponse.json({ error: existing ? "This case changed. Refresh and try again." : "Case not found" }, { status: existing ? 409 : 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    console.error("PATCH /api/cases error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
