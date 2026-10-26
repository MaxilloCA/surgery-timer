"use client";

import { useEffect, useRef, useState } from "react";
import { Stethoscope } from "lucide-react";
import anesthesiologists from "@/lib/anesthesiologists.json";

interface NewDayModalProps {
  onConfirm: (anesthetistName: string) => void;
  onCancel: () => void;
}

export default function NewDayModal({ onConfirm, onCancel }: NewDayModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitted = useRef(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

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

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitted.current) return;
    if (!anesthesiologists.includes(name)) {
      setError("Please select an anesthesiologist.");
      return;
    }
    submitted.current = true;
    onConfirm(name);
  }

  return (
    <dialog ref={dialog} aria-labelledby="new-day-title"
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
      className="fixed m-auto w-[calc(100%_-_1.5rem)] max-w-lg max-h-[90vh] overflow-hidden rounded-2xl border border-border bg-bg-secondary p-0 text-text-primary backdrop:bg-black/70">
      <form onSubmit={handleSubmit} className="flex min-h-0 max-h-[90vh] flex-col gap-4 p-5"
        style={{ maxHeight: "calc(100dvh - 2rem)", paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <div className="flex shrink-0 items-center gap-3">
          <Stethoscope size={26} className="shrink-0 text-accent-teal" />
          <div>
            <h2 id="new-day-title" className="text-lg font-semibold">New Operating Day</h2>
            <p className="text-sm text-text-secondary">Tap a name. Swipe the list to see more.</p>
          </div>
        </div>

        <div role="radiogroup" aria-label="Anesthesiologist" aria-describedby={error ? "anesthetist-error" : undefined}
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain rounded-xl border border-border bg-bg-primary"
          style={{ maxHeight: "min(45dvh, 24rem)", WebkitOverflowScrolling: "touch" }}>
          {anesthesiologists.map((doctor) => (
            <label key={doctor} className={`flex min-h-12 cursor-pointer items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0 ${name === doctor ? "bg-accent-teal/15 text-accent-teal" : "text-text-primary"}`}>
              <input type="radio" name="anesthetist" value={doctor} checked={name === doctor} required
                onChange={() => { setName(doctor); setError(""); }}
                className="h-5 w-5 shrink-0 accent-accent-teal" />
              <span className="text-base">{doctor}</span>
            </label>
          ))}
        </div>

        <div className="shrink-0 space-y-3">
          <p aria-live="polite" className="text-sm text-text-secondary">{name || "Select an anesthesiologist above."}</p>
          {error && <p id="anesthetist-error" role="alert" className="text-sm text-accent-red">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="min-h-12 rounded-xl border border-border px-4 text-text-secondary">Cancel</button>
            <button id="confirm-new-day" type="submit" disabled={!name}
              className="min-h-12 flex-1 rounded-xl bg-accent-teal px-4 font-bold text-bg-primary disabled:opacity-40">
              Start Day
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
