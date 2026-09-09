import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAppUrl,
  creatorUrl,
  authOrigin,
  siteConfig,
} from "../lib/site.ts";
import { getSupabaseConfig } from "../lib/supabase/config.ts";
test("brand and creator links use one canonical origin", () => {
  assert.equal(siteConfig.name, "ReplyPass");
  assert.equal(siteConfig.domain, "getreplypass.com");
  assert.equal(creatorUrl("@stella"), `${siteConfig.url}/@stella`);
  assert.equal(creatorUrl("stella"), creatorUrl("@stella"));
  assert.throws(() => creatorUrl("//evil.example"));
  assert.equal(
    normalizeAppUrl("https://getreplypass.com/"),
    "https://getreplypass.com",
  );
  for (const url of [
    "javascript:alert(1)",
    "https://user:secret@example.com",
    "https://example.com/path",
    "http://example.com",
    "https://example.com?next=x",
  ])
    assert.throws(() => normalizeAppUrl(url));
});
test("auth stays on loopback locally and configured origin in production", () => {
  assert.equal(authOrigin("http://localhost:3000"), "http://localhost:3000");
  assert.equal(authOrigin("http://127.0.0.1:3003"), "http://127.0.0.1:3003");
  assert.equal(authOrigin("https://untrusted.example"), siteConfig.url);
});
test("Supabase public configuration rejects privileged keys and partial setup", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    assert.equal(getSupabaseConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    assert.throws(() => getSupabaseConfig());
    for (const key of [
      "sb_secret_fake_test_value_only",
      `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`,
    ]) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
      assert.throws(() => getSupabaseConfig(), /privileged/);
    }
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      "sb_publishable_example_for_test";
    assert.equal(getSupabaseConfig()?.url, "https://example.supabase.co");
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
