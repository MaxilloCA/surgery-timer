import { and, isNull, sql } from "drizzle-orm";
import { cases, sessions } from "./db/schema";
import { isSessionDate, isUuid } from "./desktop-sync";

// Keep the parent check in every case query: a deleted day hides even late desktop uploads.
export function visibleCase() {
  return and(isNull(cases.deletedAt), sql`exists (select 1 from ${sessions} where ${sessions.id} = ${cases.sessionId} and ${sessions.deletedAt} is null)`);
}

export function validateDeletion(body: unknown, kind: "case" | "day"): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Invalid request";
  const value = body as Record<string, unknown>;
  if (kind === "case") return isUuid(value.id) ? null : "Invalid case ID";
  return isSessionDate(value.date) ? null : "Invalid date";
}
