import { processWebhook } from "@/lib/stripe/webhooks";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Signature required", { status: 400 });
  const body = await request.text();
  if (body.length > 1000000)
    return new Response("Payload too large", { status: 413 });
  try {
    await processWebhook(body, signature);
    return Response.json({ received: true });
  } catch (error) {
    return new Response("Webhook not processed", {
      status:
        error instanceof Error && /signature|test events/.test(error.message)
          ? 400
          : 503,
    });
  }
}
