import assert from "node:assert/strict";
import test from "node:test";
import { isSessionDate, isUuid, validateDesktopCase } from "./desktop-sync";

const started = {
  clientGeneratedId: "3b90b4a0-1db4-4da0-9321-bc759bf471ff",
  sessionId: "48fcb01f-5eac-4d4a-8038-279d8b7efea7",
  caseNumber: 1,
  surgeryStart: "2026-10-17T12:00:00.000Z",
};
const finished = {
  ...started,
  surgeryEnd: "2026-10-17T12:05:00.000Z",
  surgeryDurationSec: 300,
  turnoverStart: "2026-10-17T12:05:00.000Z",
  turnoverEnd: "2026-10-17T12:06:00.000Z",
  turnoverDurationSec: 60,
};

test("desktop session IDs and dates reject malformed values before database writes", () => {
  assert.equal(isUuid(started.clientGeneratedId), true);
  assert.equal(isUuid("not-an-id"), false);
  assert.equal(isSessionDate("2026-02-30"), false);
  assert.equal(isSessionDate("2026-10-17"), true);
});

test("started, completed, and zero-duration intervals are valid", () => {
  assert.equal(validateDesktopCase(started), null);
  assert.equal(validateDesktopCase(finished), null);
  assert.equal(validateDesktopCase({ ...started, surgeryEnd: started.surgeryStart, surgeryDurationSec: 0 }), null);
});

test("rejects unsafe IDs, noninteger durations, and timezone-ambiguous timestamps", () => {
  for (const change of [
    { clientGeneratedId: "invalid" }, { sessionId: "invalid" }, { caseNumber: 0 },
    { caseNumber: 1.5 }, { surgeryStart: "2026-10-17T12:00:00" },
    { surgeryEnd: "invalid" }, { surgeryDurationSec: -1 },
    { surgeryDurationSec: 1.5 }, { turnoverDurationSec: 2147483648 }, { notes: 123 },
  ]) assert.notEqual(validateDesktopCase({ ...finished, ...change }), null);
});

test("rejects impossible interval order and durations without endpoints", () => {
  assert.notEqual(validateDesktopCase({ ...started, surgeryEnd: "2026-10-17T11:59:00Z" }), null);
  assert.notEqual(validateDesktopCase({ ...started, surgeryDurationSec: 300 }), null);
  assert.notEqual(validateDesktopCase({ ...started, turnoverStart: "2026-10-17T12:05:00Z" }), null);
  assert.notEqual(validateDesktopCase({ ...started, turnoverEnd: "2026-10-17T12:05:00Z" }), null);
  assert.notEqual(validateDesktopCase({ ...finished, turnoverEnd: "2026-10-17T12:04:00Z" }), null);
});

test("duration seconds must match elapsed timestamps rounded down", () => {
  assert.notEqual(validateDesktopCase({ ...finished, surgeryDurationSec: 299 }), null);
  assert.notEqual(validateDesktopCase({ ...finished, turnoverDurationSec: 61 }), null);
  assert.equal(validateDesktopCase({ ...started, surgeryEnd: "2026-10-17T12:00:01.999Z", surgeryDurationSec: 1 }), null);
});
