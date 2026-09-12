import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseRatingInput } from "../lib/ratings.ts";

const interactionId = "10000000-0000-4000-8000-000000000001";

test("rating input accepts a completed interaction score and trims feedback", () => {
  assert.deepEqual(
    parseRatingInput({ interactionId, score: 5, review: "  Lovely reply  " }),
    { interactionId, score: 5, review: "Lovely reply" },
  );
});

test("rating input rejects invalid identifiers, scores, and oversized reviews", () => {
  assert.equal(parseRatingInput({ interactionId: "guess", score: 5 }), null);
  assert.equal(parseRatingInput({ interactionId, score: 0 }), null);
  assert.equal(parseRatingInput({ interactionId, score: 4.5 }), null);
  assert.equal(parseRatingInput({ interactionId, score: 5, review: "x".repeat(1001) }), null);
});

test("database policy binds published ratings to the paying fan and completed interaction", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/202609130001_verified_ratings.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /paid\.fan_id <> rater/);
  assert.match(sql, /paid\.status not in \('captured', 'completed'\)/);
  assert.match(sql, /on conflict\(interaction_id\)/);
  assert.match(sql, /grant execute .* to service_role/);
});
