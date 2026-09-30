// Basic smoke tests using Node's built-in test runner + supertest.
// Requires a running Postgres reachable via DATABASE_URL (see .env) and
// migrated schema — run `npm run migrate && npm run seed` first, or point
// this at a disposable test database.
const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../src/app");

test("health check responds ok", async () => {
  const res = await request(app).get("/health");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, "ok");
});

test("widgets endpoint rejects missing auth", async () => {
  const res = await request(app).get("/api/widgets");
  assert.strictEqual(res.status, 401);
});

test("submissions endpoint rejects a non-UUID widgetId", async () => {
  const res = await request(app)
    .post("/submissions")
    .send({ widgetId: "not-a-uuid", data: { name: "x" } });
  assert.strictEqual(res.status, 400);
  assert.ok(res.body.error);
});

test("submissions endpoint rejects oversized payloads with 413", async () => {
  const res = await request(app)
    .post("/submissions")
    .send({ widgetId: "00000000-0000-0000-0000-000000000000", data: { name: "A".repeat(25000) } });
  assert.strictEqual(res.status, 413);
});

test("CORS preflight on /submissions returns allow headers", async () => {
  const res = await request(app)
    .options("/submissions")
    .set("Origin", "http://localhost:5500")
    .set("Access-Control-Request-Method", "POST");
  assert.strictEqual(res.status, 204);
  assert.strictEqual(res.headers["access-control-allow-origin"], "http://localhost:5500");
});
