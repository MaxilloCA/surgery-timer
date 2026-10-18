import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { DELETE as deleteCase } from "../app/api/cases/route";
import { POST as createManual } from "../app/api/cases/manual/route";
import { DELETE as deleteSession } from "../app/api/sessions/route";

for (const [name, handler, bodies] of [
  ["case", deleteCase, ["{", "null", "[]", "{}", '{"id":"bad"}']],
  ["session", deleteSession, ["{", "null", "[]", "{}", '{"date":"2026-10-17"}', '{"sessionId":"bad"}']],
] as const) {
  test(`${name} deletion rejects malformed requests before any database access`, async () => {
    for (const body of bodies) {
      const result = await handler(new NextRequest(`http://localhost/api/${name}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body,
      }));
      assert.equal(result.status, 400, body);
      assert.equal(typeof (await result.json()).error, "string");
    }
  });
}

test("manual entry rejects an empty case and invalid IDs before database access", async () => {
  const id = "3b90b4a0-1db4-4da0-9321-bc759bf471ff";
  for (const body of [null, {}, { id, sessionId: id, surgeryStart: null, surgeryEnd: null, turnoverStart: null, turnoverEnd: null }]) {
    const result = await createManual(new NextRequest("http://localhost/api/cases/manual", { method: "POST", body: JSON.stringify(body) }));
    assert.equal(result.status, 400);
  }
});
