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
    "/terms",
    "/privacy",
    "/community-guidelines",
    "/creator-terms",
  ]) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200, route);
    if (route === "/@stella") assert.match(await response.text(), /Stella May/);
  }
  assert.equal((await fetch(`${base}/@missing`)).status, 404);
  const root = await fetch(base, { redirect: "manual" });
  assert.equal(root.status, 200);
  assert.match(await root.text(), /A little closer to the people you follow/);
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

test("production identity and draft trust metadata render", async () => {
  const html = await (
    await fetch(`${base}/@stella`, { headers: { "User-Agent": "Twitterbot" } })
  ).text();
  const canonical =
    process.env.NEXT_PUBLIC_APP_URL || "https://getreplypass.com";
  assert.ok(html.includes(`${canonical}/@stella`));
  assert.match(html, /property="og:site_name" content="ReplyPass"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /rel="canonical"/);
  for (const route of [
    "/terms",
    "/privacy",
    "/community-guidelines",
    "/creator-terms",
  ]) {
    const page = await (await fetch(`${base}${route}`)).text();
    assert.match(page, /Draft placeholder/);
    assert.match(page, /noindex/);
  }
  const image = await fetch(`${base}/og`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type"), /image\/png/);
});

test("financial APIs reject anonymous mutations and unsigned webhooks", async () => {
  for (const route of ["/api/payments/reply", "/api/payments/reply/11111111-1111-4111-8111-111111111111", "/api/creator/payouts"]) {
    const response = await fetch(base + route, {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    assert.equal(response.status,401,route);
  }
  assert.equal((await fetch(base + "/api/admin/payments/11111111-1111-4111-8111-111111111111/refund", {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})).status,403);
  assert.equal((await fetch(base + "/api/cron/payments")).status,401);
  assert.equal((await fetch(base + "/api/stripe/webhook", {method:"POST",body:'{"type":"payment_intent.succeeded"}'})).status,400);
});
