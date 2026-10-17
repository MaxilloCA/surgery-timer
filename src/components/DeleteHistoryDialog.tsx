"use client";

import { useEffect, useRef, useState } from "react";
import type { CaseTimes, TimeField } from "./EditCaseTimes";

export default function DeleteHistoryDialog({ title, description, endpoint, payload, onClose, onDeleted, onConflict }: {
  title: string;
  description: string;
  endpoint: string;
  payload: { date: string } | { id: string; field?: TimeField; original?: Partial<CaseTimes> };
  onClose: () => void;
  onDeleted: (updated?: CaseTimes) => void;
  onConflict?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const deletingRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    cancelButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function remove() {
    if (deletingRef.current || conflict) return;
    deletingRef.current = true;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409) {
          setConflict(true);
          onConflict?.();
          throw new Error("This case changed. Close this dialog and review its latest times before deleting.");
        }
        throw new Error(data?.error || "Unable to delete history. Please try again.");
      }
      onDeleted(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete history. Please try again.");
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="delete-history-title" aria-describedby="delete-history-description"
      onCancel={(event) => { event.preventDefault(); if (!deletingRef.current) onClose(); }}
      className="fixed z-[60] m-auto w-[calc(100%_-_2rem)] max-w-md max-h-[85dvh] overflow-y-auto rounded-2xl border border-border bg-bg-card p-5 text-text-primary backdrop:bg-black/70">
      <h2 id="delete-history-title" className="text-lg font-semibold">{title}</h2>
      <div id="delete-history-description" className="mt-3 space-y-3 text-sm text-text-secondary">
        <p>{description}</p>
        <p>This removes the selected history and updates shared PC and iPhone statistics. There is no Undo button.</p>
        <p>Finish timing the case or day on your timer first. Deleting history does not stop a running timer.</p>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button ref={cancelButton} type="button" disabled={deleting} onClick={onClose}
          className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50">{conflict ? "Close" : "Cancel"}</button>
        <button type="button" disabled={deleting || conflict} onClick={() => void remove()}
          className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{deleting ? "Deleting…" : "Delete"}</button>
      </div>
    </dialog>
  );
}
