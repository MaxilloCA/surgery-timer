import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sessions, cases } from "@/lib/db/schema";
import { eq, asc, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    let rows: Array<{
      sessionDate: string;
      anesthetistName: string;
      caseNumber: number;
      surgeryStart: Date | null;
      surgeryEnd: Date | null;
      surgeryDurationSec: number | null;
      turnoverDurationSec: number | null;
      notes: string | null;
    }>;

    if (sessionId) {
      const session = await getDb().query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
      });
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      const sessionCases = await getDb()
        .select()
        .from(cases)
        .where(eq(cases.sessionId, sessionId))
        .orderBy(asc(cases.caseNumber));

      rows = sessionCases.map((c) => ({
        sessionDate: session.date,
        anesthetistName: session.anesthetistName,
        caseNumber: c.caseNumber,
        surgeryStart: c.surgeryStart,
        surgeryEnd: c.surgeryEnd,
        surgeryDurationSec: c.surgeryDurationSec,
        turnoverDurationSec: c.turnoverDurationSec,
        notes: c.notes,
      }));
    } else {
      // All sessions
      const allSessions = await getDb().select().from(sessions).orderBy(desc(sessions.date));
      rows = [];
      for (const s of allSessions) {
        const sessionCases = await getDb()
          .select()
          .from(cases)
          .where(eq(cases.sessionId, s.id))
          .orderBy(asc(cases.caseNumber));
        for (const c of sessionCases) {
          rows.push({
            sessionDate: s.date,
            anesthetistName: s.anesthetistName,
            caseNumber: c.caseNumber,
            surgeryStart: c.surgeryStart,
            surgeryEnd: c.surgeryEnd,
            surgeryDurationSec: c.surgeryDurationSec,
            turnoverDurationSec: c.turnoverDurationSec,
            notes: c.notes,
          });
        }
      }
    }

    const headers: Record<string, string> = {
      "Date": "",
      "Anesthetist": "",
      "Case #": "",
      "Surgery Start": "",
      "Surgery End": "",
      "Surgery Duration (min)": "",
      "Turnover Duration (min)": "",
      "Notes": "",
    };

    const csvRows = [
      Object.keys(headers).join(","),
      ...rows.map((r) =>
        [
          r.sessionDate,
          `"${r.anesthetistName}"`,
          r.caseNumber,
          r.surgeryStart ? new Date(r.surgeryStart).toISOString() : "",
          r.surgeryEnd ? new Date(r.surgeryEnd).toISOString() : "",
          r.surgeryDurationSec != null ? Math.round(r.surgeryDurationSec / 60) : "",
          r.turnoverDurationSec != null ? Math.round(r.turnoverDurationSec / 60) : "",
          r.notes ? `"${r.notes.replace(/"/g, '""')}"` : "",
        ].join(",")
      ),
    ].join("\n");

    const filename = sessionId ? `session-${sessionId.slice(0, 8)}.csv` : "all-sessions.csv";

    return new NextResponse(csvRows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
