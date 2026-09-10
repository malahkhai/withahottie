// Isolated UI contract test: Stripe.js and checkout HTTP responses are mocked by Playwright.
// Run against a build with coherent fake TEST credentials; never points at Stripe/Supabase.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || undefined,
  headless: true,
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let secured = false,
    verificationCalls = 0;
  const attempts = [];
  await context.route("https://js.stripe.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
    window.Stripe = function() {
      const element={mount(node){node.innerHTML='<p data-testid="mock-card">Test card payment element</p>';},destroy(){},unmount(){},on(){},off(){},update(){}};
      return { _registerWrapper(){}, registerAppInfo(){}, createToken(){}, createPaymentMethod(){}, confirmCardPayment(){},
        elements(){return {create(){return element},getElement(){return element},update(){},submit:async()=>({}),on(){},off(){}}},
        async confirmPayment(){window.__confirmations=(window.__confirmations||0)+1;return window.__declined ? {error:{message:'Your card has insufficient funds. No request was sent.'}} : {paymentIntent:{status:'requires_capture'}};}
      };
    };
  `,
    }),
  );
  await context.route("**/api/payments/reply", async (route) => {
    const payload = route.request().postDataJSON();
    attempts.push(payload);
    assert.deepEqual(Object.keys(payload).sort(), [
      "attemptKey",
      "creatorId",
      "message",
    ]);
    await route.fulfill({
      json: {
        id: "11111111-1111-4111-8111-111111111111",
        clientSecret: "pi_test_secret_example",
        amountCents: 400,
        currency: "eur",
      },
    });
  });
  await context.route(
    "**/api/payments/reply/11111111-1111-4111-8111-111111111111",
    async (route) => {
      verificationCalls++;
      await route.fulfill({
        json: {
          secured,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      });
    },
  );
  const base = process.env.TEST_APP_URL || "http://127.0.0.1:3004";
  async function open() {
    await page.goto(base + "/@stella");
    await page.getByRole("button", { name: /Message me/ }).click();
    await page
      .getByRole("textbox", { name: "What do you want to say?" })
      .fill("What inspired your latest project?");
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await page.getByTestId("mock-card").waitFor();
  }
  await open();
  await page.evaluate(() => {
    window.__declined = true;
  });
  await page.getByRole("button", { name: /Request reply/ }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "insufficient funds" })
    .waitFor();
  assert.equal(
    verificationCalls,
    0,
    "declined confirmation cannot create a secured request",
  );
  assert.equal(
    await page.getByText("Request sent ✓", { exact: true }).count(),
    0,
  );
  await page.reload();
  await open();
  assert.equal(
    attempts[0].attemptKey,
    attempts[1].attemptKey,
    "refresh/retry reuses purchase identity",
  );
  await page.getByRole("button", { name: /Request reply/ }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "checking your reservation" })
    .waitFor();
  assert.equal(
    await page.getByText("Request sent ✓", { exact: true }).count(),
    0,
    "browser Stripe result alone is not authority",
  );
  secured = true;
  await page.getByRole("button", { name: "Check reservation" }).click();
  await page.getByRole("heading", { name: "Request sent ✓" }).waitFor();
  assert.equal(
    await page.evaluate(() => window.__confirmations),
    1,
    "status retry does not repeat confirmation",
  );
  await page.getByText("You haven’t been charged.", { exact: false }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: path.join(os.tmpdir(), "replypass-secured-checkout-mobile.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mocked Payment Element, insufficient funds, no premature success, immutable attempt identity, server-confirmed authorization, status retry, 390px layout.",
  );
} finally {
  await browser.close();
}
