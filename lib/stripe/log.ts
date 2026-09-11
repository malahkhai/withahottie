type Result =
  "started" | "succeeded" | "ignored" | "duplicate" | "unmatched" | "failed";

/** Structured financial-operation logs. Never pass messages, user IDs, keys, or card data. */
export function paymentLog(
  event: string,
  result: Result,
  paymentId?: string | null,
) {
  console.info(
    JSON.stringify({
      scope: "replypass_payment",
      event,
      payment_id: paymentId || null,
      result,
    }),
  );
}
