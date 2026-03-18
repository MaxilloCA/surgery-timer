"use client";

import { formatDurationMinutes } from "@/lib/utils";

interface TodayCase {
  caseNumber: number;
  surgeryDurationSec: number;
  turnoverDurationSec: number | null;
}

interface StatsPanelProps {
  cases: TodayCase[];
  currentSurgerySec?: number;
}

export default function StatsPanel({ cases, currentSurgerySec }: StatsPanelProps) {
  const completedCases = cases.filter((c) => c.surgeryDurationSec > 0);
  const surgeries = completedCases.map((c) => c.surgeryDurationSec);
  const turnovers = completedCases
    .filter((c) => c.turnoverDurationSec != null)
    .map((c) => c.turnoverDurationSec!);

  const totalSurgery =
    surgeries.reduce((a, b) => a + b, 0) + (currentSurgerySec ?? 0);
  const avgSurgery =
    surgeries.length > 0
      ? Math.round(surgeries.reduce((a, b) => a + b, 0) / surgeries.length)
      : null;
  const avgTurnover =
    turnovers.length > 0
      ? Math.round(turnovers.reduce((a, b) => a + b, 0) / turnovers.length)
      : null;

  const stats = [
    {
      id: "stat-cases",
      label: "Cases",
      value: cases.length,
      unit: "",
      color: "text-accent-teal",
    },
    {
      id: "stat-total-or",
      label: "Total OR",
      value: totalSurgery > 0 ? formatDurationMinutes(totalSurgery) : "—",
      unit: "",
      color: "text-accent-blue",
    },
    {
      id: "stat-avg-surgery",
      label: "Avg Surgery",
      value: avgSurgery != null ? formatDurationMinutes(avgSurgery) : "—",
      unit: "",
      color: "text-accent-green",
    },
    {
      id: "stat-avg-turnover",
      label: "Avg Turnover",
      value: avgTurnover != null ? formatDurationMinutes(avgTurnover) : "—",
      unit: "",
      color: "text-accent-amber",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <div key={s.id} id={s.id} className="glass-card p-4 fade-in">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-1">{s.label}</p>
          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
