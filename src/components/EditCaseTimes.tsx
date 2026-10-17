"use client";

import { useEffect, useRef, useState } from "react";

export interface CaseTimes {
  id: string;
  caseNumber: number;
  surgeryStart: string | null;
  surgeryEnd: string | null;
  turnoverStart: string | null;
  turnoverEnd: string | null;
  surgeryDurationSec: number | null;
  turnoverDurationSec: number | null;
  notes: string | null;
}

function localInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export const timeFields = [
  ["surgeryStart", "Surgery in"],
  ["surgeryEnd", "Surgery out"],
  ["turnoverStart", "Turnover in"],
  ["turnoverEnd", "Turnover out"],
] as const;
export type TimeField = typeof timeFields[number][0];

export default function EditCaseTimes({ record, sessionId, contextLabel, onClose, onSaved, onConflict }: {
  record: CaseTimes;
  sessionId?: string;
  contextLabel?: string;
  onClose: () => void;
  onSaved: (record: CaseTimes) => void;
  onConflict: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const savingRef = useRef(false);
  const [values, setValues] = useState(() => Object.fromEntries(timeFields.map(([key]) => [key, localInput(record[key])])) as Record<TimeField, string>);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (savingRef.current || conflict) return;
    setError("");
    const original = Object.fromEntries(timeFields.map(([key]) => [key, record[key]]));
    const updated: Record<string, string | null> = {};
    for (const [key, label] of timeFields) {
      const value = values[key];
      // Preserve the exact stored instant (including milliseconds and DST offset) if untouched.
      if (value === localInput(record[key])) {
        updated[key] = record[key];
      } else if (!value) {
        updated[key] = null;
      } else {
        const date = new Date(value);
        const comparable = value.replace(/\.0+$/, "");
        if (Number.isNaN(date.getTime()) || localInput(date.toISOString()) !== (comparable.length === 16 ? `${comparable}:00` : comparable)) {
          setError(`${label} is not a valid local time. Check the date and daylight-saving transition.`);
          return;
        }
        updated[key] = date.toISOString();
      }
    }
    if (sessionId && !Object.values(updated).some(Boolean)) {
      setError("Enter at least one time for the missed case.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const response = await fetch(sessionId ? "/api/cases/manual" : "/api/cases", {
        method: sessionId ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionId ? { id: record.id, sessionId, ...updated } : { id: record.id, original, ...updated }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          setConflict(true);
          onConflict();
          throw new Error(sessionId ? "This session changed. Close this form and refresh history before adding the case again." : "This case changed since you opened it. Close this form and reopen Edit times to review the latest times before saving.");
        }
        throw new Error(data.error || "Unable to save times. Please try again.");
      }
      onSaved(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save times. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="edit-times-title" aria-describedby="edit-times-description"
      onCancel={(event) => { event.preventDefault(); if (!savingRef.current) onClose(); }}
      className="fixed z-[60] m-auto w-[calc(100%_-_2rem)] max-w-md max-h-[85dvh] overflow-y-auto rounded-2xl border border-border bg-bg-card p-5 text-text-primary backdrop:bg-black/70">
      <form onSubmit={save}>
        <h2 id="edit-times-title" className="text-lg font-semibold">{sessionId ? "Add missed case" : `Edit case #${record.caseNumber} times`}</h2>
        <div id="edit-times-description" className="mt-2 text-sm text-text-secondary space-y-2">
          <p>Local time: {timezone}. Include the correct date for cases crossing midnight.</p>
          {contextLabel && <p>{contextLabel}</p>}
          <p>Changes update shared history and statistics. They do not change a running PC or iPhone timer. Finish timing the case before correcting its history.</p>
        </div>
        <div className="my-5 space-y-4">
          {timeFields.map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`edit-${key}`} className="mb-1 block text-sm font-medium">{label}</label>
              <input id={`edit-${key}`} type="datetime-local" step="1"
                value={values[key]} disabled={saving || conflict}
                onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                className="block w-full min-w-0 rounded-lg border border-border bg-bg-primary p-2.5 text-sm focus:outline-none focus:border-accent-teal disabled:opacity-60" />
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted">Leave missing times blank. Durations need both start and stop times. You can type a time or use the date and time picker.</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50">{conflict ? "Close" : "Cancel"}</button>
          <button type="submit" disabled={saving || conflict} className="rounded-lg bg-accent-teal px-4 py-2 text-sm font-semibold text-bg-primary disabled:opacity-50">{saving ? "Saving…" : sessionId ? "Add case" : "Save times"}</button>
        </div>
      </form>
    </dialog>
  );
}
