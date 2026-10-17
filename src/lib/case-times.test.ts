import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { changedTimeLocks, durationSeconds, timerMerge, validateCorrection, validateTimes } from "./case-times";

const times = { surgeryStart: "2026-10-17T12:00:00Z", surgeryEnd: "2026-10-17T12:05:00Z", turnoverStart: "2026-10-17T12:05:00Z", turnoverEnd: "2026-10-17T12:07:00Z" };
const correction = { id: "3b90b4a0-1db4-4da0-9321-bc759bf471ff", original: times, ...times };

test("corrections derive elapsed seconds including midnight and zoned timestamps", () => {
  assert.equal(validateCorrection(correction), null);
  assert.deepEqual(durationSeconds(times), { surgeryDurationSec: 300, turnoverDurationSec: 120 });
  const midnight = { ...times, surgeryStart: "2026-10-17T23:59:00-04:00", surgeryEnd: "2026-10-18T04:01:00Z", turnoverStart: null, turnoverEnd: null };
  assert.equal(validateCorrection({ ...correction, ...midnight, original: midnight }), null);
  assert.equal(durationSeconds(midnight).surgeryDurationSec, 120);
});

test("corrections reject bad timestamps, invalid ordering, missing originals, and missing fields", () => {
  for (const change of [
    { id: "invalid" }, { original: undefined }, { surgeryStart: undefined }, { surgeryEnd: undefined },
    { surgeryStart: "2026-10-17T12:00:00" }, { surgeryEnd: "bad" },
    { surgeryEnd: "2026-10-17T11:00:00Z" }, { turnoverStart: "2026-10-17T12:04:00Z" },
    { turnoverEnd: "2026-10-17T12:04:00Z" },
    { surgeryStart: "1900-01-01T00:00:00Z" },
  ]) assert.notEqual(validateCorrection({ ...correction, ...change }), null);
});

test("any endpoint may be removed or entered independently", () => {
  for (const field of ["surgeryStart", "surgeryEnd", "turnoverStart", "turnoverEnd"]) {
    const partial = { ...times, [field]: null };
    assert.equal(validateCorrection({ ...correction, ...partial }), null);
  }
  const partial = { surgeryStart: null, surgeryEnd: times.surgeryEnd, turnoverStart: null, turnoverEnd: null };
  assert.equal(validateTimes(partial), null);
  assert.deepEqual(durationSeconds(partial), { surgeryDurationSec: null, turnoverDurationSec: null });
  assert.equal(validateTimes({ ...partial, turnoverEnd: "2026-10-17T11:00:00Z" }), "Times must be in surgery/turnover order");
});

test("timer merges honor timestamp locks and preserve browser placeholder start behavior", () => {
  const incoming = { surgeryEnd: sql`excluded.surgery_end`, turnoverStart: sql`excluded.turnover_start`, turnoverEnd: sql`excluded.turnover_end` };
  const merge = timerMerge(incoming);
  const render = (value: ReturnType<typeof sql>) => new PgDialect().sqlToQuery(value);
  assert.match(render(merge.set.surgeryEnd).sql, /any\("cases"\."locked_times"\)/);
  assert.deepEqual(render(merge.set.surgeryEnd).params, ["surgeryEnd"]);
  assert.equal("surgeryStart" in merge.set, false);
  const desktopMerge = timerMerge({ ...incoming, surgeryStart: sql`excluded.surgery_start` });
  assert.equal("surgeryStart" in desktopMerge.set, true);
  assert.match(render(desktopMerge.set.surgeryStart!).sql, /any\("cases"\."locked_times"\)/);
  const cleared = { ...times, surgeryStart: null };
  const locks = render(changedTimeLocks(times, cleared));
  assert.deepEqual(locks.params, ["surgeryStart"]);
  assert.match(locks.sql, /\|\| ARRAY\[/);
  assert.deepEqual(render(changedTimeLocks(times, times)).params, []);
});
