import { sql, type SQL } from "drizzle-orm";
import { cases } from "./db/schema";
import { isUuid } from "./desktop-sync";

export const timeFields = ["surgeryStart", "surgeryEnd", "turnoverStart", "turnoverEnd"] as const;
export type CaseTimes = Record<typeof timeFields[number], string | null>;

export function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

export function validateCorrection(body: Record<string, unknown>): string | null {
  if (!isUuid(body.id)) return "Invalid case ID";
  const original = body.original as Record<string, unknown> | undefined;
  if (!original || typeof original !== "object") return "Original timestamps are required";
  for (const source of [body, original]) {
    for (const field of timeFields) {
      if (source[field] !== null && !validTimestamp(source[field])) return `Invalid ${field}`;
    }
    if (!validTimestamp(source.surgeryStart)) return "Surgery start is required";
  }
  if (!validTimestamp(body.surgeryEnd)) return "Surgery end is required";
  if ((body.turnoverStart === null) !== (body.turnoverEnd === null)) return "Both turnover times are required";
  if (body.turnoverStart === null && (original.turnoverStart !== null || original.turnoverEnd !== null)) return "Existing turnover times cannot be cleared";
  const times = body as CaseTimes;
  if (Date.parse(times.surgeryEnd!) < Date.parse(times.surgeryStart!)) return "Surgery end must be at or after its start";
  if (times.turnoverStart !== null && Date.parse(times.turnoverStart) < Date.parse(times.surgeryEnd!)) return "Turnover must start at or after surgery ends";
  if (times.turnoverEnd !== null && Date.parse(times.turnoverEnd) < Date.parse(times.turnoverStart!)) return "Turnover end must be at or after its start";
  for (const seconds of Object.values(durationSeconds(times))) {
    if (seconds !== null && seconds > 2147483647) return "Duration is too large";
  }
  return null;
}

export function durationSeconds(times: CaseTimes) {
  return {
    surgeryDurationSec: times.surgeryEnd === null ? null : Math.floor((Date.parse(times.surgeryEnd) - Date.parse(times.surgeryStart!)) / 1000),
    turnoverDurationSec: times.turnoverEnd === null || times.turnoverStart === null ? null : Math.floor((Date.parse(times.turnoverEnd) - Date.parse(times.turnoverStart)) / 1000),
  };
}

// Normal timer uploads can fill empty endpoints, but only PATCH can change saved times.
export function timerMerge(incoming: { surgeryEnd: SQL; turnoverStart: SQL; turnoverEnd: SQL }) {
  const surgeryEnd = sql`coalesce(${cases.surgeryEnd}, ${incoming.surgeryEnd})`;
  const turnoverStart = sql`coalesce(${cases.turnoverStart}, ${incoming.turnoverStart})`;
  const turnoverEnd = sql`coalesce(${cases.turnoverEnd}, ${incoming.turnoverEnd})`;
  const surgeryDurationSec = sql`floor(extract(epoch from (${surgeryEnd} - ${cases.surgeryStart})))::integer`;
  const turnoverDurationSec = sql`floor(extract(epoch from (${turnoverEnd} - ${turnoverStart})))::integer`;
  return {
    set: { surgeryEnd, turnoverStart, turnoverEnd, surgeryDurationSec, turnoverDurationSec },
    valid: sql`(${surgeryEnd} is null or ${surgeryEnd} >= ${cases.surgeryStart})
      and (${turnoverStart} is null or (${surgeryEnd} is not null and ${turnoverStart} >= ${surgeryEnd}))
      and (${turnoverEnd} is null or (${turnoverStart} is not null and ${turnoverEnd} >= ${turnoverStart}))
      and (${surgeryEnd} is null or extract(epoch from (${surgeryEnd} - ${cases.surgeryStart})) < 2147483648)
      and (${turnoverEnd} is null or extract(epoch from (${turnoverEnd} - ${turnoverStart})) < 2147483648)`,
  };
}
