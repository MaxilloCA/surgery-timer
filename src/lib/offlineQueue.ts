// Offline queue for buffering API writes when there is no network connection.
// Pending requests are stored in localStorage under QUEUE_KEY and flushed
// automatically when the browser comes back online.

const QUEUE_KEY = "or_timer_offline_queue";

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body: string;
  timestamp: number;
}

function loadQueue(): QueuedRequest[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedRequest[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(url: string, method: string, body: object): void {
  const queue = loadQueue();
  queue.push({
    id: crypto.randomUUID(),
    url,
    method,
    body: JSON.stringify(body),
    timestamp: Date.now(),
  });
  saveQueue(queue);
}

export async function flushQueue(): Promise<void> {
  if (typeof window === "undefined" || !navigator.onLine) return;

  const queue = loadQueue();
  if (queue.length === 0) return;

  const remaining: QueuedRequest[] = [];

  for (const req of queue) {
    try {
      const res = await fetch(req.url, {
        method: req.method,
        headers: { "Content-Type": "application/json" },
        body: req.body,
      });
      if (!res.ok) {
        console.warn("Queued request failed, will retry:", req.url);
        remaining.push(req);
      }
    } catch {
      remaining.push(req);
    }
  }

  saveQueue(remaining);
}

// Persist active timer state so a page refresh doesn't lose the running clock.
const TIMER_STATE_KEY = "or_timer_state";

export interface PersistedTimerState {
  sessionId: string | null;
  anesthetistName: string | null;
  sessionDate: string | null; // ISO date string YYYY-MM-DD
  phase: "idle" | "surgery" | "turnover";
  caseNumber: number;
  phaseStartedAt: number | null; // epoch ms
  currentCaseId: string | null;
  todayCases: Array<{
    caseNumber: number;
    surgeryDurationSec: number;
    turnoverDurationSec: number | null;
  }>;
}

export const defaultTimerState: PersistedTimerState = {
  sessionId: null,
  anesthetistName: null,
  sessionDate: null,
  phase: "idle",
  caseNumber: 0,
  phaseStartedAt: null,
  currentCaseId: null,
  todayCases: [],
};

export function loadTimerState(): PersistedTimerState {
  if (typeof window === "undefined") return defaultTimerState;
  try {
    return JSON.parse(localStorage.getItem(TIMER_STATE_KEY) ?? "null") ?? defaultTimerState;
  } catch {
    return defaultTimerState;
  }
}

export function saveTimerState(state: PersistedTimerState): void {
  localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
}

export function clearTimerState(): void {
  localStorage.removeItem(TIMER_STATE_KEY);
}
