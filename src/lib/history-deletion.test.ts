import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { sessionDeletionFilter, visibleCase, validateDeletion } from "./history-deletion";

const id = "3b90b4a0-1db4-4da0-9321-bc759bf471ff";
test("deletion requires one case or session ID and rejects date-only scope", () => {
  assert.equal(validateDeletion({ id }, "case"), null);
  assert.equal(validateDeletion({ sessionId: id }, "session"), null);
  for (const body of [null, [], "", {}, { id: "bad" }, { id: 42 }]) {
    assert.notEqual(validateDeletion(body, "case"), null);
  }
  for (const body of [null, [], {}, { date: "2026-10-17" }, { sessionId: "bad" }, { sessionId: 42 }, { date: "2026-10-17", anesthetistName: "Dr. Chan" }]) {
    assert.notEqual(validateDeletion(body, "session"), null);
  }
});

test("session deletion targets only its UUID, regardless of shared date or provider", () => {
  const query = new PgDialect().sqlToQuery(sessionDeletionFilter(id)!);
  assert.match(query.sql, /"sessions"\."id" = \$1/);
  assert.match(query.sql, /"sessions"\."deleted_at" is null/);
  assert.doesNotMatch(query.sql, /"date"|"anesthetist_name"/);
  assert.deepEqual(query.params, [id]);
});

test("history filters exclude deleted cases and cases whose parent day was deleted", () => {
  const query = new PgDialect().sqlToQuery(visibleCase()!);
  assert.match(query.sql, /"cases"\."deleted_at" is null/);
  assert.match(query.sql, /exists \(select 1 from "sessions"/);
  assert.match(query.sql, /"sessions"\."id" = "cases"\."session_id"/);
  assert.match(query.sql, /"sessions"\."deleted_at" is null/);
});
