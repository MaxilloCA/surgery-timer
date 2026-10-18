import { and, eq, isNull, sql } from "drizzle-orm";
import { cases, sessions } from "./db/schema";
import { isUuid } from "./desktop-sync";

// Keep the parent check in every case query: a deleted session hides even late desktop uploads.
export function visibleCase() {
  return and(isNull(cases.deletedAt), sql`exists (select 1 from ${sessions} where ${sessions.id} = ${cases.sessionId} and ${sessions.deletedAt} is null)`);
}

export function sessionDeletionFilter(sessionId: string) {
  return and(eq(sessions.id, sessionId), isNull(sessions.deletedAt));
}

export function validateDeletion(body: unknown, kind: "case" | "session"): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Invalid request";
  const value = body as Record<string, unknown>;
  if (kind === "case") return isUuid(value.id) ? null : "Invalid case ID";
  return isUuid(value.sessionId) ? null : "Invalid session ID. Refresh history and select one session.";
}
