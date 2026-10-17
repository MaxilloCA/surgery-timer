import { sql, type SQL } from "drizzle-orm";
import { cases } from "./db/schema";
import { isUuid } from "./desktop-sync";

export const timeFields = ["surgeryStart", "surgeryEnd", "turnoverStart", "turnoverEnd"] as const;
export type CaseTimes = Record<typeof timeFields[number], string | null>;

export function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

export function validateTimes(source: Record<string, unknown>): string | null {
  for (const field of timeFields) {
    if (source[field] !== null && !validTimestamp(source[field])) return `Invalid ${field}`;
  }
  // Missing endpoints are allowed; every known timestamp must still be in order.
  const known = timeFields.map(field => source[field]).filter((value): value is string => typeof value === "string");
  for (let i = 1; i < known.length; i++) {
    if (Date.parse(known[i]) < Date.parse(known[i - 1])) return "Times must be in surgery/turnover order";
  }
  for (const seconds of Object.values(durationSeconds(source as CaseTimes))) {
    if (seconds !== null && seconds > 2147483647) return "Duration is too large";
  }
  return null;
}

export function validateCorrection(body: Record<string, unknown>): string | null {
  if (!isUuid(body.id)) return "Invalid case ID";
  const original = body.original;
  if (!original || typeof original !== "object" || Array.isArray(original)) return "Original timestamps are required";
  for (const field of timeFields) {
    const value = (original as Record<string, unknown>)[field];
    if (value !== null && !validTimestamp(value)) return `Invalid original ${field}`;
  }
  return validateTimes(body);
}

export function durationSeconds(times: CaseTimes) {
  return {
    surgeryDurationSec: times.surgeryStart === null || times.surgeryEnd === null ? null : Math.floor((Date.parse(times.surgeryEnd) - Date.parse(times.surgeryStart)) / 1000),
    turnoverDurationSec: times.turnoverEnd === null || times.turnoverStart === null ? null : Math.floor((Date.parse(times.turnoverEnd) - Date.parse(times.turnoverStart)) / 1000),
  };
}

export function changedTimeLocks(original: CaseTimes, times: CaseTimes) {
  const changed = timeFields.filter(field => original[field] === null ? times[field] !== null : times[field] === null || Date.parse(original[field]!) !== Date.parse(times[field]!));
  return sql`${cases.lockedTimes} || ARRAY[${sql.join(changed.map(field => sql`${field}`), sql`, `)}]::text[]`;
}

// Explicitly edited or cleared endpoints are never filled by an old timer upload.
export function timerMerge(incoming: { surgeryStart?: SQL; surgeryEnd: SQL; turnoverStart: SQL; turnoverEnd: SQL }) {
  const merge = (field: typeof timeFields[number], value: SQL) => sql`case when ${field} = any(${cases.lockedTimes}) then ${cases[field]} else coalesce(${cases[field]}, ${value}) end`;
  const surgeryStart = incoming.surgeryStart ? merge("surgeryStart", incoming.surgeryStart) : sql`${cases.surgeryStart}`;
  const surgeryEnd = merge("surgeryEnd", incoming.surgeryEnd);
  const turnoverStart = merge("turnoverStart", incoming.turnoverStart);
  const turnoverEnd = merge("turnoverEnd", incoming.turnoverEnd);
  const surgeryDurationSec = sql`floor(extract(epoch from (${surgeryEnd} - ${surgeryStart})))::integer`;
  const turnoverDurationSec = sql`floor(extract(epoch from (${turnoverEnd} - ${turnoverStart})))::integer`;
  const ordered = [[surgeryStart, surgeryEnd], [surgeryStart, turnoverStart], [surgeryStart, turnoverEnd], [surgeryEnd, turnoverStart], [surgeryEnd, turnoverEnd], [turnoverStart, turnoverEnd]];
  return {
    set: { ...(incoming.surgeryStart ? { surgeryStart } : {}), surgeryEnd, turnoverStart, turnoverEnd, surgeryDurationSec, turnoverDurationSec },
    valid: sql`${sql.join(ordered.map(([start, end]) => sql`(${start} is null or ${end} is null or ${end} >= ${start})`), sql` and `)}
      and (${surgeryEnd} is null or ${surgeryStart} is null or extract(epoch from (${surgeryEnd} - ${surgeryStart})) < 2147483648)
      and (${turnoverEnd} is null or ${turnoverStart} is null or extract(epoch from (${turnoverEnd} - ${turnoverStart})) < 2147483648)`,
  };
}
