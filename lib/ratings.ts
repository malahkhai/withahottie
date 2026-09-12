export type RatingInput = {
  interactionId: string;
  score: number;
  review: string | null;
};

export function parseRatingInput(value: unknown): RatingInput | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const score = Number(body.score);
  const review = typeof body.review === "string" ? body.review.trim() : null;
  if (
    typeof body.interactionId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.interactionId) ||
    !Number.isInteger(score) ||
    score < 1 ||
    score > 5 ||
    (review?.length || 0) > 1000
  ) return null;
  return { interactionId: body.interactionId, score, review: review || null };
}

