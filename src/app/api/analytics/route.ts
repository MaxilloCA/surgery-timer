import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sessions, cases } from "@/lib/db/schema";
import { and, isNull, eq, asc } from "drizzle-orm";

import { visibleCase } from "@/lib/history-deletion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allSessions = await getDb().select().from(sessions).where(isNull(sessions.deletedAt)).orderBy(asc(sessions.date));

    const dailyStats: Array<{
      date: string;
      anesthetistName: string;
      caseCount: number;
      avgSurgeryMin: number;
      avgTurnoverMin: number;
      totalSurgeryMin: number;
    }> = [];

    const anesthetistMap: Record<
      string,
      { totalSurgery: number; totalTurnover: number; count: number }
    > = {};

    for (const s of allSessions) {
      const sessionCases = await getDb()
        .select()
        .from(cases)
        .where(and(eq(cases.sessionId, s.id), visibleCase()))
        .orderBy(asc(cases.caseNumber));

      const surgeryDurations = sessionCases
        .filter((c) => c.surgeryDurationSec != null)
        .map((c) => c.surgeryDurationSec!);
      const turnoverDurations = sessionCases
        .filter((c) => c.turnoverDurationSec != null)
        .map((c) => c.turnoverDurationSec!);

      const avgSurgery =
        surgeryDurations.length > 0
          ? surgeryDurations.reduce((a, b) => a + b, 0) / surgeryDurations.length
          : 0;
      const avgTurnover =
        turnoverDurations.length > 0
          ? turnoverDurations.reduce((a, b) => a + b, 0) / turnoverDurations.length
          : 0;
      const totalSurgery = surgeryDurations.reduce((a, b) => a + b, 0);

      dailyStats.push({
        date: s.date,
        anesthetistName: s.anesthetistName,
        caseCount: sessionCases.length,
        avgSurgeryMin: Math.round(avgSurgery / 60),
        avgTurnoverMin: Math.round(avgTurnover / 60),
        totalSurgeryMin: Math.round(totalSurgery / 60),
      });

      if (!anesthetistMap[s.anesthetistName]) {
        anesthetistMap[s.anesthetistName] = { totalSurgery: 0, totalTurnover: 0, count: 0 };
      }
      anesthetistMap[s.anesthetistName].totalSurgery += avgSurgery;
      anesthetistMap[s.anesthetistName].totalTurnover += avgTurnover;
      anesthetistMap[s.anesthetistName].count += 1;
    }

    const anesthetistStats = Object.entries(anesthetistMap).map(([name, v]) => ({
      name,
      avgSurgeryMin: Math.round(v.totalSurgery / v.count / 60),
      avgTurnoverMin: Math.round(v.totalTurnover / v.count / 60),
      sessionCount: v.count,
    }));

    return NextResponse.json({ dailyStats, anesthetistStats });
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
