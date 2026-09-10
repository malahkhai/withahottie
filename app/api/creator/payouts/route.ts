import { getViewer } from "@/lib/auth/session";
import { fail, readJson } from "@/lib/http";
import { onboardConnect } from "@/lib/stripe/connect";
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || !["creator", "admin"].includes(viewer.role))
    return fail("Creator sign-in required.", 401);
  try {
    await readJson(request);
    return Response.json({
      url: await onboardConnect(viewer.id, new URL(request.url).origin),
    });
  } catch {
    return fail(
      "Unable to start Stripe test onboarding. Check your platform configuration or try again.",
      409,
    );
  }
}
