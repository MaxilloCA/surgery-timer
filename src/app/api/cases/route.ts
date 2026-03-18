import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cases } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

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
