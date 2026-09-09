import assert from "node:assert/strict";
import test from "node:test";
const base = process.env.TEST_APP_URL || "http://127.0.0.1:3000";
test("production routes render without credentials", async () => {
  for (const route of [
    "/@stella",
    "/%40stella",
    "/login",
    "/signup",
    "/creator/apply",
  ]) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200, route);
    if (route === "/@stella") assert.match(await response.text(), /Stella May/);
  }
  assert.equal((await fetch(`${base}/@missing`)).status, 404);
  const root = await fetch(base, { redirect: "manual" });
  assert.equal(root.status, 307);
  assert.equal(root.headers.get("location"), "/@stella");
});
test("checkout derives its quote and keeps same-origin protection", async () => {
  const post = (body, origin = base) =>
    fetch(`${base}/api/checkout/demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body,
    });
  const good = await post(
    JSON.stringify({
      kind: "message",
      message: "Hello Stella",
      amountCents: 1,
    }),
  );
  assert.equal(good.status, 200);
  assert.deepEqual(await good.json(), {
    mode: "demo",
    amountCents: 400,
    currency: "eur",
    charged: false,
  });
  assert.equal((await post("{")).status, 400);
  assert.equal(
    (await post(JSON.stringify({ kind: "message", message: "" }))).status,
    400,
  );
  assert.equal((await post("x".repeat(10001))).status, 413);
  assert.equal(
    (
      await post(
        JSON.stringify({ kind: "message", message: "Hello" }),
        "https://untrusted.example",
      )
    ).status,
    403,
  );
});
