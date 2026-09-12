import { getViewer } from "@/lib/auth/session";
import { fail, readJson } from "@/lib/http";
import { serviceDatabase } from "@/lib/stripe/server";
import { parseRatingInput } from "@/lib/ratings";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return fail("Fan sign-in required.", 401);

  try {
    const body = parseRatingInput(await readJson(request));
    if (!body) return fail("Choose a rating from 1 to 5.");

    const { data, error } = await serviceDatabase().rpc(
      "submit_interaction_rating",
      {
        rater: viewer.id,
        interaction: body.interactionId,
        rating_score: body.score,
        rating_review: body.review,
      },
    );
    if (error || !data) return fail("This completed request cannot be rated.", 403);
    return Response.json({ ok: true, score: data.score });
  } catch {
    return fail("Your rating could not be saved.");
  }
}
