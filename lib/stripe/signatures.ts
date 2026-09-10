import Stripe from "stripe";
/** No event is decoded until the raw payload passes Stripe's timestamped signature check. */
export function verifyEventSignature(
  raw: string,
  header: string,
  secrets: string[],
) {
  const stripe = new Stripe("sk_test_signature_verification_only");
  for (const secret of secrets) {
    try {
      stripe.webhooks.signature!.verifyHeader(raw, header, secret, 300);
      return;
    } catch {
      /* Try only explicitly configured endpoint secrets. */
    }
  }
  throw Error("Invalid webhook signature.");
}
