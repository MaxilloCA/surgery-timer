"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Square, CheckCircle, Clock, Wifi, WifiOff, FileText } from "lucide-react";
import NewDayModal from "@/components/NewDayModal";
import StatsPanel from "@/components/StatsPanel";
import {
  loadTimerState,
  saveTimerState,
  clearTimerState,
  defaultTimerState,
  enqueue,
  flushQueue,
  type PersistedTimerState,
} from "@/lib/offlineQueue";
import { formatDuration, getLocalDateString } from "@/lib/utils";

type Phase = "idle" | "surgery" | "turnover";

export default function TimerPage() {
  const [state, setState] = useState<PersistedTimerState>(defaultTimerState);
  const [elapsed, setElapsed] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    const persisted = loadTimerState();
    // Reset if it's a new calendar day
    const today = getLocalDateString();
    if (persisted.sessionDate && persisted.sessionDate !== today) {
      clearTimerState();
      setState(defaultTimerState);
    } else {
      setState(persisted);
    }
    setIsOnline(navigator.onLine);
  }, []);

  // Online/offline detection + queue flush
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Tick the clock
  useEffect(() => {
    if (state.phase === "idle" || state.phaseStartedAt == null) {
      setElapsed(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const tick = () => {
      const now = Date.now();
      setElapsed(Math.floor((now - state.phaseStartedAt!) / 1000));
    };
    tick();
    intervalRef.current = setInterval(tick, 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.phase, state.phaseStartedAt]);

  const updateState = useCallback((next: PersistedTimerState) => {
    setState(next);
    saveTimerState(next);
  }, []);

  async function apiCall(url: string, method: string, body: object): Promise<unknown> {
    if (!navigator.onLine) {
      enqueue(url, method, body);
      return null;
    }
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("API error");
      return res.json();
    } catch {
      enqueue(url, method, body);
      return null;
    }
  }

  async function handleStart() {
    const today = getLocalDateString();

    // If no session yet today, show the anesthetist modal
    if (!state.sessionId || state.sessionDate !== today) {
      setShowModal(true);
      return;
    }

    await startCase(state.sessionId, state.anesthetistName!, today);
  }

  async function startCase(sessionId: string, anesthetistName: string, today: string) {
    const now = Date.now();
    const newCaseNumber = state.caseNumber + 1;

    // If coming from turnover, record turnover end + duration on previous case
    if (state.phase === "turnover" && state.phaseStartedAt && state.currentCaseId) {
      const turnoverDurationSec = Math.floor((now - state.phaseStartedAt) / 1000);
      await apiCall("/api/cases", "POST", {
        id: state.currentCaseId,
        sessionId,
        caseNumber: state.caseNumber,
        surgeryStart: new Date(0).toISOString(), // placeholder, real values already saved
        turnoverEnd: new Date(now).toISOString(),
        turnoverDurationSec,
      });
    }

    // Create new case record
    const surgeryStart = new Date(now).toISOString();
    const created = (await apiCall("/api/cases", "POST", {
      sessionId,
      caseNumber: newCaseNumber,
      surgeryStart,
    })) as { id: string } | null;

    const caseId = created?.id ?? crypto.randomUUID();

    const next: PersistedTimerState = {
      ...state,
      sessionId,
      anesthetistName,
      sessionDate: today,
      phase: "surgery",
      caseNumber: newCaseNumber,
      phaseStartedAt: now,
      currentCaseId: caseId,
    };
    updateState(next);
    setNotes("");
  }

  async function handleEnd() {
    if (state.phase !== "surgery" || !state.phaseStartedAt || !state.currentCaseId) return;
    setIsSaving(true);
    const now = Date.now();
    const surgeryDurationSec = Math.floor((now - state.phaseStartedAt) / 1000);

    // Save notes + surgery end
    await apiCall("/api/cases", "POST", {
      id: state.currentCaseId,
      sessionId: state.sessionId,
      caseNumber: state.caseNumber,
      surgeryStart: new Date(state.phaseStartedAt).toISOString(),
      surgeryEnd: new Date(now).toISOString(),
      surgeryDurationSec,
      turnoverStart: new Date(now).toISOString(),
      notes: notes.trim() || null,
    });

    const newCase = {
      caseNumber: state.caseNumber,
      surgeryDurationSec,
      turnoverDurationSec: null,
    };

    const next: PersistedTimerState = {
      ...state,
      phase: "turnover",
      phaseStartedAt: now,
      todayCases: [...state.todayCases, newCase],
    };
    updateState(next);
    setNotes("");
    setShowNotes(false);
    setIsSaving(false);
  }

  async function handleEndDay() {
    clearTimerState();
    setState(defaultTimerState);
    setNotes("");
    setShowNotes(false);
  }

  async function handleModalConfirm(anesthetistName: string) {
    setShowModal(false);
    const today = getLocalDateString();

    // Create session
    const session = (await apiCall("/api/sessions", "POST", {
      anesthetistName,
      date: today,
    })) as { id: string } | null;

    const sessionId = session?.id ?? crypto.randomUUID();

    // Update state with new session info then start case
    const next: PersistedTimerState = {
      ...defaultTimerState,
      sessionId,
      anesthetistName,
      sessionDate: today,
      caseNumber: 0,
      todayCases: [],
    };
    updateState(next);
    await startCase(sessionId, anesthetistName, today);
  }

  const phaseColor =
    state.phase === "surgery"
      ? "text-accent-green"
      : state.phase === "turnover"
      ? "text-accent-amber"
      : "text-text-muted";

  const phaseGlow =
    state.phase === "surgery"
      ? "glow-green"
      : state.phase === "turnover"
      ? "glow-amber"
      : "";

  const phaseLabel =
    state.phase === "surgery"
      ? "IN SURGERY"
      : state.phase === "turnover"
      ? "TURNOVER"
      : "READY";

  const phaseBg =
    state.phase === "surgery"
      ? "bg-accent-green/10 border-accent-green/30 text-accent-green"
      : state.phase === "turnover"
      ? "bg-accent-amber/10 border-accent-amber/30 text-accent-amber"
      : "bg-text-muted/10 border-text-muted/20 text-text-muted";

  return (
    <div className="flex flex-col min-h-screen px-4 pt-10 pb-4 max-w-lg mx-auto">
      {showModal && <NewDayModal onConfirm={handleModalConfirm} onCancel={() => setShowModal(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">OR Timer</h1>
          {state.anesthetistName && (
            <p className="text-sm text-text-secondary mt-0.5">
              Anesthetist: <span className="text-accent-teal">{state.anesthetistName}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi size={16} className="text-accent-green" />
          ) : (
            <WifiOff size={16} className="text-accent-amber" />
          )}
          <span className={`text-xs ${isOnline ? "text-accent-green" : "text-accent-amber"}`}>
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* Timer Display */}
      <div
        className={`glass-card ${phaseGlow} flex flex-col items-center justify-center py-12 mb-6 transition-all duration-500`}
      >
        {/* Status badge */}
        <span className={`text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full border mb-6 ${phaseBg}`}>
          {phaseLabel}
          {state.caseNumber > 0 && state.phase !== "idle" && (
            <span className="ml-2 opacity-60">Case {state.caseNumber}</span>
          )}
        </span>

        {/* Big clock */}
        <div
          id="timer-display"
          className={`timer-display text-7xl font-extrabold tracking-tight ${phaseColor} ${
            state.phase !== "idle" ? "timer-pulse" : ""
          }`}
        >
          {formatDuration(elapsed)}
        </div>

        <p className="text-xs text-text-muted mt-3 uppercase tracking-widest">
          {state.phase === "surgery"
            ? "Surgery in progress"
            : state.phase === "turnover"
            ? "Room turnover"
            : "Press START to begin"}
        </p>
      </div>

      {/* Notes input — only visible during surgery */}
      {state.phase === "surgery" && (
        <div className="mb-4 fade-in">
          {!showNotes ? (
            <button
              id="toggle-notes"
              onClick={() => setShowNotes(true)}
              className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent-teal transition-colors"
            >
              <FileText size={15} />
              Add case note
            </button>
          ) : (
            <div className="glass-card p-3">
              <textarea
                id="case-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes for this case..."
                rows={3}
                className="w-full bg-transparent text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none"
              />
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 mb-6">
        {state.phase !== "surgery" && (
          <button
            id="btn-start"
            onClick={handleStart}
            disabled={isSaving}
            className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-accent-green text-white font-bold text-xl glow-green active:scale-[0.97] transition-all duration-150 disabled:opacity-50"
          >
            <Play size={24} fill="white" />
            START
          </button>
        )}

        {state.phase === "surgery" && (
          <button
            id="btn-end"
            onClick={handleEnd}
            disabled={isSaving}
            className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-accent-red text-white font-bold text-xl glow-red active:scale-[0.97] transition-all duration-150 disabled:opacity-50"
          >
            <Square size={24} fill="white" />
            {isSaving ? "Saving..." : "END"}
          </button>
        )}

        {state.caseNumber > 0 && state.phase !== "surgery" && (
          <button
            id="btn-end-day"
            onClick={handleEndDay}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl border border-border text-text-secondary font-semibold text-base active:scale-[0.97] transition-all duration-150 hover:border-accent-teal hover:text-accent-teal"
          >
            <CheckCircle size={20} />
            End Day
          </button>
        )}
      </div>

      {/* Today's Stats */}
      {state.todayCases.length > 0 && (
        <div className="fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-text-muted" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              Today's Session
            </h2>
          </div>
          <StatsPanel
            cases={state.todayCases}
            currentSurgerySec={state.phase === "surgery" ? elapsed : 0}
          />
        </div>
      )}
    </div>
  );
}
