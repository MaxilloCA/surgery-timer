import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cases } from "@/lib/db/schema";
import { eq, asc, and, or, isNull, sql } from "drizzle-orm";
import { validateDesktopCase } from "@/lib/desktop-sync";

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
      // Completion is monotonic: delayed retries cannot clear a completed interval.
      // Notes are only inserted here, preserving any later edits made on the website.
      const [synced] = await getDb().insert(cases).values({
        id: body.clientGeneratedId, sessionId, caseNumber,
        surgeryStart: new Date(surgeryStart),
        surgeryEnd: surgeryEnd ? new Date(surgeryEnd) : null,
        surgeryDurationSec: surgeryDurationSec ?? null,
        turnoverStart: turnoverStart ? new Date(turnoverStart) : null,
        turnoverEnd: turnoverEnd ? new Date(turnoverEnd) : null,
        turnoverDurationSec: turnoverDurationSec ?? null,
        notes: notes ?? null,
      }).onConflictDoUpdate({
        target: cases.id,
        set: {
          surgeryEnd: sql`coalesce(${cases.surgeryEnd}, excluded.surgery_end)`,
          surgeryDurationSec: sql`coalesce(${cases.surgeryDurationSec}, excluded.surgery_duration_sec)`,
          turnoverStart: sql`coalesce(${cases.turnoverStart}, excluded.turnover_start)`,
          turnoverEnd: sql`coalesce(${cases.turnoverEnd}, excluded.turnover_end)`,
          turnoverDurationSec: sql`coalesce(${cases.turnoverDurationSec}, excluded.turnover_duration_sec)`,
        },
        setWhere: and(
          eq(cases.sessionId, sessionId), eq(cases.caseNumber, caseNumber), eq(cases.surgeryStart, new Date(surgeryStart)),
          surgeryEnd == null ? undefined : or(isNull(cases.surgeryEnd), eq(cases.surgeryEnd, new Date(surgeryEnd))),
          surgeryDurationSec == null ? undefined : or(isNull(cases.surgeryDurationSec), eq(cases.surgeryDurationSec, surgeryDurationSec)),
          turnoverStart == null ? undefined : or(isNull(cases.turnoverStart), eq(cases.turnoverStart, new Date(turnoverStart))),
          turnoverEnd == null ? undefined : or(isNull(cases.turnoverEnd), eq(cases.turnoverEnd, new Date(turnoverEnd))),
          turnoverDurationSec == null ? undefined : or(isNull(cases.turnoverDurationSec), eq(cases.turnoverDurationSec, turnoverDurationSec)),
        ),
      }).returning();
      if (!synced) return NextResponse.json({ error: "Case ID conflicts with existing history" }, { status: 409 });
      return NextResponse.json(synced);
    }

    // Upsert — if id provided, update; otherwise insert
    if (id) {
      const [updated] = await getDb()
        .update(cases)
        .set({
          surgeryEnd: surgeryEnd ? new Date(surgeryEnd) : undefined,
          surgeryDurationSec,
          turnoverStart: turnoverStart ? new Date(turnoverStart) : undefined,
          turnoverEnd: turnoverEnd ? new Date(turnoverEnd) : undefined,
          turnoverDurationSec,
          notes,
        })
        .where(eq(cases.id, id))
        .returning();
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
