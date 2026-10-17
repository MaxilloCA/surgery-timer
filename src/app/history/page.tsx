"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Download, Calendar, User, Loader2 } from "lucide-react";
import { formatDurationMinutes, formatDisplayDate } from "@/lib/utils";
import EditCaseTimes, { CaseTimes, timeFields, TimeField } from "@/components/EditCaseTimes";
import DeleteHistoryDialog from "@/components/DeleteHistoryDialog";

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
  const [editing, setEditing] = useState<{ sessionId: string; record: CaseRecord; creating?: boolean; contextLabel?: string } | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [deleting, setDeleting] = useState<
    { kind: "day"; date: string } | { kind: "case" | "time"; sessionId: string; date: string; record: CaseRecord; field?: TimeField } | null
  >(null);

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
                              {timeFields.map(([field, label]) => (
                                <div key={field} className="flex items-center justify-between gap-2">
                                  <p>{label}: {displayTime(c[field])}</p>
                                  {c[field] && <button type="button" aria-label={`Delete ${label.toLowerCase()} time for case ${c.caseNumber}`}
                                    onClick={() => { setSaveMessage(""); setDeleting({ kind: "time", sessionId: session.id, date: session.date, record: c, field }); }}
                                    className="min-h-11 shrink-0 rounded-lg px-2 text-red-400 hover:bg-red-400/10">Delete</button>}
                                </div>
                              ))}
                              <div className="flex flex-wrap gap-2">
                              <button type="button" aria-label={`Edit times for case ${c.caseNumber}`}
                                onClick={() => { setSaveMessage(""); setEditing({ sessionId: session.id, record: c }); }}
                                className="mt-2 min-h-10 rounded-lg border border-accent-teal/30 px-3 py-2 text-accent-teal hover:bg-accent-teal/10">Edit times</button>
                              <button type="button" aria-label={`Delete case ${c.caseNumber}`}
                                onClick={() => { setSaveMessage(""); setDeleting({ kind: "case", sessionId: session.id, date: session.date, record: c }); }}
                                className="mt-2 min-h-10 rounded-lg border border-red-400/30 px-3 py-2 text-red-400 hover:bg-red-400/10">Delete case</button>
                              </div>
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
                    <div className="border-t border-border/50 px-4 py-3">
                      <button type="button" disabled={loadingCases === session.id}
                        onClick={() => {
                          setSaveMessage("");
                          setEditing({ sessionId: session.id, creating: true, contextLabel: `${formatDisplayDate(session.date)} · ${session.anesthetistName}`,
                            record: { id: crypto.randomUUID(), caseNumber: 0, surgeryStart: null, surgeryEnd: null, turnoverStart: null, turnoverEnd: null, surgeryDurationSec: null, turnoverDurationSec: null, notes: null } });
                        }}
                        className="mb-3 mr-2 min-h-11 rounded-lg border border-accent-teal/30 px-3 py-2 text-sm text-accent-teal hover:bg-accent-teal/10 disabled:opacity-50">Add missed case</button>
                      <button type="button" aria-label={`Delete all history for ${formatDisplayDate(session.date)}`}
                        onClick={() => { setSaveMessage(""); setDeleting({ kind: "day", date: session.date }); }}
                        className="min-h-11 rounded-lg border border-red-400/30 px-3 py-2 text-sm text-red-400 hover:bg-red-400/10">Delete day</button>
                      <p className="mt-2 text-xs text-text-muted">Deletes this date for all anesthesiologists, including any hidden by your filter.</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {deleting && <DeleteHistoryDialog
        title={deleting.kind === "day" ? `Delete ${formatDisplayDate(deleting.date)}?` : deleting.kind === "time" ? `Delete ${timeFields.find(([key]) => key === deleting.field)?.[1].toLowerCase()} time?` : `Delete case #${deleting.record.caseNumber}?`}
        description={deleting.kind === "day"
          ? `All sessions, cases, surgery and turnover times, and notes for ${formatDisplayDate(deleting.date)} will be deleted for every anesthesiologist, including sessions hidden by your filter.`
          : deleting.kind === "time" && deleting.field
            ? `${timeFields.find(([key]) => key === deleting.field)?.[1]}: ${displayTime(deleting.record[deleting.field])}, case #${deleting.record.caseNumber} for ${formatDisplayDate(deleting.date)}. Only this timestamp will be removed. Its duration will be unavailable until both start and stop times are entered.`
            : `Case #${deleting.record.caseNumber} for ${formatDisplayDate(deleting.date)}, including its surgery in/out, turnover in/out, and notes, will be deleted.`}
        endpoint={deleting.kind === "day" ? "/api/sessions" : "/api/cases"}
        payload={deleting.kind === "day" ? { date: deleting.date } : deleting.kind === "time" ? { id: deleting.record.id, field: deleting.field, original: Object.fromEntries(timeFields.map(([key]) => [key, deleting.record[key]])) } : { id: deleting.record.id }}
        onClose={() => setDeleting(null)}
        onConflict={() => { if (deleting.kind !== "day") void reloadCases(deleting.sessionId); }}
        onDeleted={(updated) => {
          if (deleting.kind === "day") {
            const deletedSessionIds = new Set(sessions.filter((session) => session.date === deleting.date).map((session) => session.id));
            setSessions((previous) => previous.filter((session) => session.date !== deleting.date));
            setCasesBySession((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => !deletedSessionIds.has(id))));
            if (expanded && deletedSessionIds.has(expanded)) setExpanded(null);
            setSaveMessage(`All history for ${formatDisplayDate(deleting.date)} deleted. Shared statistics are updated.`);
          } else if (deleting.kind === "time" && updated) {
            setCasesBySession((previous) => ({ ...previous, [deleting.sessionId]: (previous[deleting.sessionId] ?? []).map((record) => record.id === updated.id ? updated : record) }));
            setSaveMessage(`Case #${updated.caseNumber} time deleted. Shared statistics are updated.`);
          } else {
            setCasesBySession((previous) => ({ ...previous, [deleting.sessionId]: (previous[deleting.sessionId] ?? []).filter((record) => record.id !== deleting.record.id) }));
            setSaveMessage(`Case #${deleting.record.caseNumber} deleted. Shared statistics are updated.`);
          }
          setDeleting(null);
        }} />}
      {editing && <EditCaseTimes key={editing.record.id} record={editing.record}
        sessionId={editing.creating ? editing.sessionId : undefined} contextLabel={editing.contextLabel}
        onClose={() => setEditing(null)}
        onConflict={() => { void reloadCases(editing.sessionId); }}
        onSaved={(updated) => {
          setCasesBySession((previous) => ({ ...previous, [editing.sessionId]: [...(previous[editing.sessionId] ?? []).filter((record) => record.id !== updated.id), updated].sort((a, b) => a.caseNumber - b.caseNumber) }));
          setSaveMessage(`Case #${updated.caseNumber} ${editing.creating ? "added" : "times saved"}. Shared history and statistics are updated.`);
          setEditing(null);
        }} />}
    </div>
  );
}
