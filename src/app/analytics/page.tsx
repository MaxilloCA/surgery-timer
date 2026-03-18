"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingDown, TrendingUp, Users, BarChart2, Loader2 } from "lucide-react";

interface DailyStat {
  date: string;
  anesthetistName: string;
  caseCount: number;
  avgSurgeryMin: number;
  avgTurnoverMin: number;
  totalSurgeryMin: number;
}

interface AnesthetistStat {
  name: string;
  avgSurgeryMin: number;
  avgTurnoverMin: number;
  sessionCount: number;
}

interface AnalyticsData {
  dailyStats: DailyStat[];
  anesthetistStats: AnesthetistStat[];
}

const TEAL = "#00d4b8";
const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const BLUE = "#3b82f6";

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 text-xs border border-border/60">
        <p className="text-text-secondary mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }} className="font-semibold">
            {p.name}: {p.value} min
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/analytics");
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="text-accent-teal animate-spin" />
      </div>
    );
  }

  if (!data || data.dailyStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <BarChart2 size={48} className="text-text-muted opacity-30 mb-4" />
        <p className="text-text-muted text-sm">No data yet. Complete some sessions first.</p>
      </div>
    );
  }

  const { dailyStats, anesthetistStats } = data;
  const last30 = dailyStats.slice(-30);

  // Summary stats
  const overallAvgSurgery =
    dailyStats.length > 0
      ? Math.round(dailyStats.reduce((a, d) => a + d.avgSurgeryMin, 0) / dailyStats.length)
      : 0;
  const overallAvgTurnover =
    dailyStats.length > 0
      ? Math.round(dailyStats.reduce((a, d) => a + d.avgTurnoverMin, 0) / dailyStats.length)
      : 0;
  const totalCases = dailyStats.reduce((a, d) => a + d.caseCount, 0);
  const totalSessions = dailyStats.length;

  const summaryCards = [
    { id: "analytic-total-sessions", label: "Total Days", value: totalSessions, color: "text-accent-teal", icon: BarChart2 },
    { id: "analytic-total-cases", label: "Total Cases", value: totalCases, color: "text-accent-blue", icon: Users },
    { id: "analytic-avg-surgery", label: "Avg Surgery", value: `${overallAvgSurgery} min`, color: "text-accent-green", icon: TrendingUp },
    { id: "analytic-avg-turnover", label: "Avg Turnover", value: `${overallAvgTurnover} min`, color: "text-accent-amber", icon: TrendingDown },
  ];

  const chartData = last30.map((d) => ({
    date: d.date.slice(5), // MM-DD
    surgery: d.avgSurgeryMin,
    turnover: d.avgTurnoverMin,
    cases: d.caseCount,
  }));

  return (
    <div className="flex flex-col min-h-screen px-4 pt-10 pb-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-6">Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {summaryCards.map((c) => (
          <div key={c.id} id={c.id} className="glass-card p-4 fade-in">
            <p className="text-xs text-text-muted uppercase tracking-widest mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Surgery & Turnover Trend */}
      <div className="glass-card p-4 mb-5">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-widest mb-4">
          Surgery & Turnover Times (min)
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#475569" }} />
            <YAxis tick={{ fontSize: 10, fill: "#475569" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value) => (
                <span style={{ color: "#94a3b8" }}>{value}</span>
              )}
            />
            <Line
              type="monotone"
              dataKey="surgery"
              name="Surgery"
              stroke={GREEN}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="turnover"
              name="Turnover"
              stroke={AMBER}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Cases per day */}
      <div className="glass-card p-4 mb-5">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-widest mb-4">
          Cases Per Day
        </h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#475569" }} />
            <YAxis tick={{ fontSize: 10, fill: "#475569" }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#141c35",
                border: "1px solid #1e293b",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#94a3b8" }}
              itemStyle={{ color: TEAL }}
            />
            <Bar dataKey="cases" name="Cases" fill={TEAL} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Anesthetist comparison */}
      {anesthetistStats.length > 1 && (
        <div className="glass-card p-4 mb-5">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-widest mb-4">
            Anesthetist Comparison
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={anesthetistStats}
              layout="vertical"
              margin={{ top: 5, right: 5, left: 50, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#475569" }} unit=" min" />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                formatter={(value) => <span style={{ color: "#94a3b8" }}>{value}</span>}
              />
              <Bar dataKey="avgSurgeryMin" name="Avg Surgery" fill={GREEN} radius={[0, 4, 4, 0]} />
              <Bar dataKey="avgTurnoverMin" name="Avg Turnover" fill={AMBER} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
