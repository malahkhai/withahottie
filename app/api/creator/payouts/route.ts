import { getViewer } from "@/lib/auth/session";
import { fail, readJson } from "@/lib/http";
import {
  ConnectOnboardingError,
  onboardConnect,
} from "@/lib/stripe/connect";

function stripeFailure(error: unknown) {
  const wrapped =
    error instanceof ConnectOnboardingError ? error : undefined;
  const cause = wrapped?.cause;
  const stripeError =
    cause && typeof cause === "object"
      ? (cause as Record<string, unknown>)
      : undefined;
  return {
    stage: wrapped?.stage ?? "unknown",
    type: typeof stripeError?.type === "string" ? stripeError.type : undefined,
    code: typeof stripeError?.code === "string" ? stripeError.code : undefined,
    param: typeof stripeError?.param === "string" ? stripeError.param : undefined,
    statusCode:
      typeof stripeError?.statusCode === "number"
        ? stripeError.statusCode
        : undefined,
    requestId:
      typeof stripeError?.requestId === "string"
        ? stripeError.requestId
        : undefined,
    message:
      typeof stripeError?.message === "string"
        ? stripeError.message.slice(0, 300)
        : error instanceof Error
          ? error.message.slice(0, 300)
          : "Unknown error",
  };
}
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || !["creator", "admin"].includes(viewer.role))
    return fail("Creator sign-in required.", 401);
  try {
    await readJson(request);
    return Response.json({
      url: await onboardConnect(viewer.id, new URL(request.url).origin),
    });
  } catch (error) {
    console.error("stripe_connect_onboarding_failed", stripeFailure(error));
    return fail(
      "Unable to start Stripe payout onboarding. Please try again; if this continues, contact support.",
      409,
    );
  }
}
