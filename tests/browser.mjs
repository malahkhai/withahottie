import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
const loadPlaywright = createRequire(import.meta.url);
const { chromium } = loadPlaywright(process.env.PLAYWRIGHT_MODULE || "playwright");
import assert from "node:assert/strict";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || undefined,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.TEST_APP_URL || "http://127.0.0.1:3000";
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (value) => { window.__sharedProfile = value.url; } });
  });
  await page.goto(base + '/@stella');
  await page.getByRole('button', {name: 'Share Stella May’s profile'}).click();
  assert.equal(await page.evaluate(() => window.__sharedProfile), `${process.env.NEXT_PUBLIC_APP_URL || 'https://getreplypass.com'}/@stella`);
  for (const route of ['/terms', '/privacy', '/community-guidelines', '/creator-terms']) {
    await page.goto(base + route);
    await page.getByText('Draft placeholder — not finalized.', {exact:true}).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }

  await page.goto(base + "/creator/dashboard", { waitUntil: "domcontentloaded" });
  assert.ok(page.url().includes("/login"), "anonymous protected route");
  await page.getByRole("button", { name: "Explore creator demo" }).click();
  await page.waitForURL("**/creator/dashboard");
  await page.getByRole("heading", { name: /Good to see you/ }).waitFor();
  await page.screenshot({
    path: path.join(
      os.tmpdir(),
      "replypass-dashboard-mobile.png",
    ),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page
    .getByRole("button", { name: "Accept", exact: true })
    .first()
    .click();
  await page.goto(base + "/creator/requests", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: /Accepted/i }).click();
  await page
    .getByRole("button", { name: /Mark completed/ })
    .first()
    .click();
  await page.getByRole("tab", { name: /Completed/i }).click();
  assert.ok((await page.locator(".request-card").count()) >= 2);
  await page.getByRole("tab", { name: /Pending/i }).click();
  await page
    .getByRole("button", { name: "Decline", exact: true })
    .first()
    .click();
  await page.getByRole("tab", { name: /Expired/i }).click();
  await page.getByText("Declined.", { exact: false }).first().waitFor();
  await page.goto(base + "/creator/inbox", { waitUntil: "domcontentloaded" });
  await page.locator(".conversation-row").first().click();
  await page
    .getByRole("textbox", { name: "Your message" })
    .fill("Great to hear from you. Let’s talk!");
  await page.getByRole("button", { name: "Send message" }).click();
  await page
    .getByText("Great to hear from you. Let’s talk!", { exact: true })
    .waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByText("Great to hear from you. Let’s talk!", { exact: true })
    .waitFor();
  await page.screenshot({
    path: path.join(
      os.tmpdir(),
      "replypass-inbox-mobile.png",
    ),
    fullPage: true,
  });
  await page.goto(base + "/creator/apply", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Become a creator", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Display name" })
    .fill("Jordan Ellis");
  await page.getByRole("textbox", { name: /Username/ }).fill("jordan_ellis");
  await page
    .getByRole("textbox", { name: "Short bio" })
    .fill("Music, creativity, and the stories behind the songs.");
  await page.getByRole("button", { name: "Musician", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("heading", { name: "Where can people find you?" })
    .waitFor();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Message me price in EUR" })
    .fill("7");
  await page.getByRole("checkbox", { name: "Enable Photo request" }).uncheck();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "away", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.screenshot({
    path: path.join(
      os.tmpdir(),
      "replypass-onboarding-mobile.png",
    ),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Launch my ReplyPass" }).click();
  await page.waitForURL("**/creator/dashboard");
  await page
    .getByRole("heading", { name: /Good to see you, Jordan/ })
    .waitFor();
  await page.goto(base + "/@jordan_ellis", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("heading", { name: "Jordan Ellis", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: /Photo request/ }).count(),
    0,
  );
  await page.getByRole("button", { name: /Message me/ }).click();
  await page
    .getByRole("textbox", { name: "What do you want to say?" })
    .fill("Tell me about songwriting.");
  await page.getByRole("button", { name: /Continue — €7/ }).click();
  await page
    .getByText(
      "This is a preview of checkout. No payment was taken and no request was sent.",
    )
    .waitFor();
  await page.getByRole("button", { name: /Back to Jordan/ }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.goto(base + "/creator/settings", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Log out" }).last().click();
  await page.waitForURL("**/login");
  await page.goto(base + "/creator/inbox", { waitUntil: "domcontentloaded" });
  assert.ok(page.url().includes("/login"));
  await page.getByRole("button", { name: "Explore fan demo" }).click();
  await page.waitForURL("**/account");
  for (const tab of [
    "Messages",
    "Requests",
    "Subscriptions",
    "Purchases",
    "Saved creators",
    "Settings",
  ])
    await page.getByRole("tab", { name: tab, exact: true }).click();
  await page.goto(base + "/creator/dashboard", { waitUntil: "domcontentloaded" });
  assert.ok(
    page.url().endsWith("/account"),
    "fan cannot access creator workspace",
  );
  const missing = await page.goto(base + "/@nobody_here", {
    waitUntil: "domcontentloaded",
  });
  assert.equal(missing.status(), 404);
  await context.clearCookies();
  await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Explore creator demo" }).click();
  await page.waitForURL("**/creator/dashboard");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: path.join(
      os.tmpdir(),
      "replypass-dashboard-desktop.png",
    ),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: protected routes, demo role isolation, onboarding + pricing/availability, dynamic public page, custom checkout quote, requests accept/decline/complete, persistent inbox, fan account, logout, 390px and desktop, no runtime errors.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
