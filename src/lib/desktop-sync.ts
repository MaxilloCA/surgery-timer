// Desktop-generated IDs make retries safe after a lost network response.
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isSessionDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

export function validateDesktopCase(body: Record<string, unknown>): string | null {
  if (!isUuid(body.clientGeneratedId) || !isUuid(body.sessionId)) return "Invalid desktop ID";
  if (!Number.isInteger(body.caseNumber) || (body.caseNumber as number) < 1 || (body.caseNumber as number) > 2147483647) return "Invalid case number";
  if (!validTimestamp(body.surgeryStart)) return "Invalid surgery start";
  for (const field of ["surgeryEnd", "turnoverStart", "turnoverEnd"]) {
    if (body[field] != null && !validTimestamp(body[field])) return `Invalid ${field}`;
  }
  for (const field of ["surgeryDurationSec", "turnoverDurationSec"]) {
    if (body[field] != null && (!Number.isInteger(body[field]) || (body[field] as number) < 0 || (body[field] as number) > 2147483647)) return `Invalid ${field}`;
  }
  if (body.surgeryEnd != null && Date.parse(body.surgeryEnd as string) < Date.parse(body.surgeryStart)) return "Surgery end precedes start";
  if (body.turnoverStart != null && (body.surgeryEnd == null || Date.parse(body.turnoverStart as string) < Date.parse(body.surgeryEnd as string))) return "Invalid turnover start order";
  if (body.turnoverEnd != null && (body.turnoverStart == null || Date.parse(body.turnoverEnd as string) < Date.parse(body.turnoverStart as string))) return "Invalid turnover end order";
  if (body.surgeryDurationSec != null && body.surgeryEnd == null) return "Surgery duration requires end";
  if (body.turnoverDurationSec != null && body.turnoverEnd == null) return "Turnover duration requires end";
  if (body.surgeryDurationSec != null && body.surgeryDurationSec !== Math.floor((Date.parse(body.surgeryEnd as string) - Date.parse(body.surgeryStart)) / 1000)) return "Surgery duration does not match timestamps";
  if (body.turnoverDurationSec != null && body.turnoverDurationSec !== Math.floor((Date.parse(body.turnoverEnd as string) - Date.parse(body.turnoverStart as string)) / 1000)) return "Turnover duration does not match timestamps";
  if (body.notes != null && typeof body.notes !== "string") return "Invalid notes";
  return null;
}
