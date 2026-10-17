import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { durationSeconds, timerMerge, validateCorrection } from "./case-times";

const times = { surgeryStart: "2026-10-17T12:00:00Z", surgeryEnd: "2026-10-17T12:05:00Z", turnoverStart: "2026-10-17T12:05:00Z", turnoverEnd: "2026-10-17T12:07:00Z" };
const correction = { id: "3b90b4a0-1db4-4da0-9321-bc759bf471ff", original: times, ...times };

test("corrections derive elapsed seconds including midnight and zoned timestamps", () => {
  assert.equal(validateCorrection(correction), null);
  assert.deepEqual(durationSeconds(times), { surgeryDurationSec: 300, turnoverDurationSec: 120 });
  const midnight = { ...times, surgeryStart: "2026-10-17T23:59:00-04:00", surgeryEnd: "2026-10-18T04:01:00Z", turnoverStart: null, turnoverEnd: null };
  assert.equal(validateCorrection({ ...correction, ...midnight, original: midnight }), null);
  assert.equal(durationSeconds(midnight).surgeryDurationSec, 120);
});

test("corrections reject bad timestamps, invalid ordering, missing originals, and partial turnover", () => {
  for (const change of [
    { id: "invalid" }, { original: undefined }, { surgeryStart: null }, { surgeryEnd: null },
    { surgeryStart: "2026-10-17T12:00:00" }, { surgeryEnd: "bad" },
    { surgeryEnd: "2026-10-17T11:00:00Z" }, { turnoverStart: "2026-10-17T12:04:00Z" },
    { turnoverEnd: "2026-10-17T12:04:00Z" }, { turnoverEnd: null },
    { surgeryStart: "1900-01-01T00:00:00Z" },
  ]) assert.notEqual(validateCorrection({ ...correction, ...change }), null);
});

test("only cases with no turnover may keep both turnover endpoints null", () => {
  const empty = { ...times, turnoverStart: null, turnoverEnd: null };
  assert.equal(validateCorrection({ ...correction, original: empty, ...empty }), null);
  assert.notEqual(validateCorrection({ ...correction, ...empty }), null);
  assert.notEqual(validateCorrection({ ...correction, original: { ...times, turnoverEnd: null }, ...empty }), null);
});

test("timer merge SQL preserves corrected endpoints and computes duration using retained timestamps", () => {
  const merge = timerMerge({ surgeryEnd: sql`excluded.surgery_end`, turnoverStart: sql`excluded.turnover_start`, turnoverEnd: sql`excluded.turnover_end` });
  const render = (value: ReturnType<typeof sql>) => new PgDialect().sqlToQuery(value).sql;
  assert.equal(render(merge.set.surgeryEnd), 'coalesce("cases"."surgery_end", excluded.surgery_end)');
  assert.equal(render(merge.set.turnoverStart), 'coalesce("cases"."turnover_start", excluded.turnover_start)');
  assert.equal(render(merge.set.turnoverEnd), 'coalesce("cases"."turnover_end", excluded.turnover_end)');
  assert.equal("surgeryStart" in merge.set, false);
  assert.equal(render(merge.set.turnoverDurationSec), 'floor(extract(epoch from (coalesce("cases"."turnover_end", excluded.turnover_end) - coalesce("cases"."turnover_start", excluded.turnover_start))))::integer');
  assert.match(render(merge.valid), /coalesce\("cases"\."turnover_end", excluded.turnover_end\) >= coalesce\("cases"\."turnover_start", excluded.turnover_start\)/);
  assert.doesNotMatch(render(merge.valid), /excluded\.surgery_start|excluded\.surgery_duration|excluded\.turnover_duration/);
});
