"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Download, Calendar, User, Loader2 } from "lucide-react";
import { formatDurationMinutes, formatDisplayDate } from "@/lib/utils";
import EditCaseTimes, { CaseTimes } from "@/components/EditCaseTimes";

type CaseRecord = CaseTimes;

function displayTime(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
}

interface SessionRecord {
  id: string;
  date: string;
  anesthetistName: string;
  createdAt: string;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [casesBySession, setCasesBySession] = useState<Record<string, CaseRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingCases, setLoadingCases] = useState<string | null>(null);
  const [filterName, setFilterName] = useState("");
  const [editing, setEditing] = useState<{ sessionId: string; record: CaseRecord } | null>(null);
  const [saveMessage, setSaveMessage] = useState("");

  async function reloadCases(sessionId: string) {
    try {
      const response = await fetch(`/api/cases?sessionId=${sessionId}`);
      if (!response.ok) throw new Error("Unable to reload case times.");
      const records = await response.json();
      setCasesBySession((previous) => ({ ...previous, [sessionId]: records }));
    } catch {
      setSaveMessage("Unable to reload the latest times. Refresh this page before editing again.");
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/sessions");
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function toggleSession(sessionId: string) {
    if (expanded === sessionId) {
      setExpanded(null);
      return;
    }
    setExpanded(sessionId);
    if (!casesBySession[sessionId]) {
      setLoadingCases(sessionId);
      try {
        const res = await fetch(`/api/cases?sessionId=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setCasesBySession((prev) => ({ ...prev, [sessionId]: data }));
        }
      } finally {
        setLoadingCases(null);
      }
    }
  }

  function downloadCSV(sessionId?: string) {
    const url = sessionId ? `/api/export?sessionId=${sessionId}` : "/api/export";
    window.open(url, "_blank");
  }

  const filteredSessions = sessions.filter((s) =>
    s.anesthetistName.toLowerCase().includes(filterName.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen px-4 pt-10 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">History</h1>
        <button
          id="export-all-btn"
          onClick={() => downloadCSV()}
          className="flex items-center gap-1.5 text-sm text-accent-teal border border-accent-teal/30 rounded-xl px-3 py-2 hover:bg-accent-teal/10 transition-colors"
        >
          <Download size={14} />
          Export All
        </button>
      </div>

      {saveMessage && <p role="status" className="mb-4 text-sm text-accent-teal">{saveMessage}</p>}

      {/* Filter */}
      <div className="mb-5">
        <div className="relative">
          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            id="filter-anesthetist"
            type="text"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Filter by anesthetist..."
            className="w-full bg-bg-card border border-border rounded-xl pl-9 pr-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-teal transition-colors"
          />
        </div>
      </div>

      {/* Session List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="text-accent-teal animate-spin" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <Calendar size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No sessions recorded yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredSessions.map((session) => {
            const isExpanded = expanded === session.id;
            const sessionCases = casesBySession[session.id] ?? [];
            const completedCases = sessionCases.filter((c) => c.surgeryDurationSec != null);
            const avgSurgery =
              completedCases.length > 0
                ? Math.round(
                    completedCases.reduce((a, c) => a + (c.surgeryDurationSec ?? 0), 0) /
                      completedCases.length
                  )
                : null;

            return (
              <div key={session.id} className="glass-card overflow-hidden fade-in">
                {/* Session header */}
                <button
                  id={`session-${session.id}`}
                  className="w-full text-left p-4"
                  onClick={() => toggleSession(session.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-base font-semibold text-text-primary">
                        {formatDisplayDate(session.date)}
                      </p>
                      <p className="text-sm text-accent-teal mt-0.5">{session.anesthetistName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold text-text-primary">
                          {isExpanded && sessionCases.length > 0
                            ? `${sessionCases.length} cases`
                            : "—"}
                        </p>
                        {avgSurgery && (
                          <p className="text-xs text-text-muted">
                            avg {formatDurationMinutes(avgSurgery)}
                          </p>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={18} className="text-text-muted shrink-0" />
                      ) : (
                        <ChevronDown size={18} className="text-text-muted shrink-0" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded cases */}
                {isExpanded && (
                  <div className="border-t border-border fade-in">
                    {loadingCases === session.id ? (
                      <div className="flex justify-center py-6">
                        <Loader2 size={20} className="text-accent-teal animate-spin" />
                      </div>
                    ) : sessionCases.length === 0 ? (
                      <p className="p-4 text-sm text-text-muted">No cases recorded.</p>
                    ) : (
                      <>
                        {/* Table header */}
                        <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-widest border-b border-border/50">
                          <span>Case</span>
                          <span>Surgery</span>
                          <span>Turnover</span>
                          <span>Notes</span>
                        </div>
                        {sessionCases.map((c) => (
                          <div
                            key={c.id}
                            className="grid grid-cols-4 gap-2 px-4 py-3 text-sm border-b border-border/30 last:border-0"
                          >
                            <span className="font-semibold text-text-primary">#{c.caseNumber}</span>
                            <span className="text-accent-green">
                              {c.surgeryDurationSec != null
                                ? formatDurationMinutes(c.surgeryDurationSec)
                                : "—"}
                            </span>
                            <span className="text-accent-amber">
                              {c.turnoverDurationSec != null
                                ? formatDurationMinutes(c.turnoverDurationSec)
                                : "—"}
                            </span>
                            <span className="text-text-secondary truncate">
                              {c.notes ?? "—"}
                            </span>
                            <div className="col-span-4 mt-1 text-xs text-text-secondary space-y-1">
                              <p>Surgery in: {displayTime(c.surgeryStart)}</p>
                              <p>Surgery out: {displayTime(c.surgeryEnd)}</p>
                              <p>Turnover in: {displayTime(c.turnoverStart)}</p>
                              <p>Turnover out: {displayTime(c.turnoverEnd)}</p>
                              <button type="button" aria-label={`Edit times for case ${c.caseNumber}`}
                                onClick={() => { setSaveMessage(""); setEditing({ sessionId: session.id, record: c }); }}
                                className="mt-2 min-h-10 rounded-lg border border-accent-teal/30 px-3 py-2 text-accent-teal hover:bg-accent-teal/10">Edit times</button>
                            </div>
                          </div>
                        ))}
                        {/* Download CSV */}
                        <div className="px-4 py-3">
                          <button
                            id={`export-session-${session.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadCSV(session.id);
                            }}
                            className="flex items-center gap-2 text-xs text-accent-teal hover:underline"
                          >
                            <Download size={12} />
                            Download CSV
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {editing && <EditCaseTimes key={editing.record.id} record={editing.record}
        onClose={() => setEditing(null)}
        onConflict={() => { void reloadCases(editing.sessionId); }}
        onSaved={(updated) => {
          setCasesBySession((previous) => ({ ...previous, [editing.sessionId]: previous[editing.sessionId].map((record) => record.id === updated.id ? updated : record) }));
          setSaveMessage(`Case #${updated.caseNumber} times saved. Shared history and statistics are updated.`);
          setEditing(null);
        }} />}
    </div>
  );
}
