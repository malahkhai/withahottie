export const paymentEvents = new Set([
  "payment_intent.amount_capturable_updated",
  "payment_intent.succeeded",
  "payment_intent.canceled",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "transfer.created",
  "transfer.updated",
  "transfer.reversed",
]);

export const accountEvents = new Set([
  "v2.core.account.updated",
  "v2.core.account.closed",
  "v2.core.account[configuration.recipient].capability_status_updated",
  "v2.core.account[configuration.recipient].updated",
  "v2.core.account[requirements].updated",
]);
