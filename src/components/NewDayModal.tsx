"use client";

import { useState } from "react";
import { UserRound, Stethoscope } from "lucide-react";

interface NewDayModalProps {
  onConfirm: (anesthetistName: string) => void;
}

export default function NewDayModal({ onConfirm }: NewDayModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter the anesthetist's name.");
      return;
    }
    onConfirm(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm fade-in">
      <div className="w-full max-w-lg slide-up glass-card mx-4 mb-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-full bg-accent-teal/10 flex items-center justify-center border border-accent-teal/30">
            <Stethoscope size={20} className="text-accent-teal" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">New Operating Day</h2>
            <p className="text-sm text-text-secondary">Please enter today's anesthetist</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="anesthetist-name"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Anesthetist Name
            </label>
            <div className="relative">
              <UserRound
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                id="anesthetist-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                placeholder="Dr. Smith"
                autoFocus
                autoCapitalize="words"
                className="w-full bg-bg-primary border border-border rounded-xl pl-10 pr-4 py-3.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-teal transition-colors duration-200 text-base"
              />
            </div>
            {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}
          </div>

          <button
            id="confirm-new-day"
            type="submit"
            className="w-full py-4 rounded-xl bg-accent-teal text-bg-primary font-bold text-lg glow-teal active:scale-[0.98] transition-all duration-150"
          >
            Start Day
          </button>
        </form>
      </div>
    </div>
  );
}
