import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { visibleCase, validateDeletion } from "./history-deletion";

const id = "3b90b4a0-1db4-4da0-9321-bc759bf471ff";
test("deletion validates a single case ID or an exact real calendar date", () => {
  assert.equal(validateDeletion({ id }, "case"), null);
  assert.equal(validateDeletion({ date: "2026-10-17" }, "day"), null);
  for (const body of [null, [], "", {}, { id: "bad" }, { id: 42 }]) {
    assert.notEqual(validateDeletion(body, "case"), null);
  }
  for (const date of ["2026-02-30", "2026-10-17T00:00:00Z", "2026-1-1", "bad", null, 42]) {
    assert.notEqual(validateDeletion({ date }, "day"), null);
  }
});

test("history filters exclude deleted cases and cases whose parent day was deleted", () => {
  const query = new PgDialect().sqlToQuery(visibleCase()!);
  assert.match(query.sql, /"cases"\."deleted_at" is null/);
  assert.match(query.sql, /exists \(select 1 from "sessions"/);
  assert.match(query.sql, /"sessions"\."id" = "cases"\."session_id"/);
  assert.match(query.sql, /"sessions"\."deleted_at" is null/);
});
