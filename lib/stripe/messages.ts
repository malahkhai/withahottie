import "server-only";
import { replyService } from "./service";
import { serviceDatabase } from "./server";
import { stripeConfig } from "./config";
export async function sendSecuredMessage(
  sender: string,
  conversation: string,
  content: string,
  attachment?: { path: string; mime: string; bytes: number },
) {
  const db = serviceDatabase();
  const engine = stripeConfig() ? replyService().engine : null;
  const { data: payment } = await db
    .from("reply_payments")
    .select("*")
    .eq("conversation_id", conversation)
    .maybeSingle();
  if (payment && !engine)
    throw Error("Payment backend is required for this conversation.");
  if (payment && engine && !payment.fulfillment_message_id) {
    const { data: owner } = await db
      .from("creator_profiles")
      .select("profile_id")
      .eq("id", payment.creator_id)
      .single();
    if (owner?.profile_id === sender) {
      const intent = await engine.ensureIntent(payment);
      if (
        intent.status !== "requires_capture" ||
        intent.capturable !== payment.gross_cents
      )
        throw Error("Funds are no longer secured.");
    }
  }
  const { data, error } = await db.rpc("send_secured_message", {
    sender,
    conversation,
    content,
    ...(attachment
      ? {
          object_path: attachment.path,
          mime: attachment.mime,
          bytes: attachment.bytes,
        }
      : {}),
  });
  if (error) throw Error("Message unavailable or reply deadline passed.");
  let reconciliation = false;
  if (data.payment_id && engine) {
    try {
      await engine.reconcile(data.payment_id);
    } catch {
      reconciliation = true;
    }
  }
  return { id: data.id, reconciliation };
}
