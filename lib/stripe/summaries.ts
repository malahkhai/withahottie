import "server-only";
import { replyService } from "./service";
export async function paymentSummaries(
  userId: string,
  side: "fan" | "creator",
) {
  const { db } = replyService();
  let query = db
    .from("reply_payments")
    .select(
      "id,fan_id,creator_id,gross_cents,fee_cents,creator_cents,currency,payment_state,transfer_state,expires_at,accepted_at,conversation_id,needs_reconciliation,manual_review,created_at,declined_at,expired_at",
    );
  if (side === "fan") query = query.eq("fan_id", userId);
  else {
    const { data } = await db
      .from("creator_profiles")
      .select("id")
      .eq("profile_id", userId)
      .single();
    if (!data) return [];
    query = query.eq("creator_id", data.id).not("authorized_at", "is", null);
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw Error("Unable to load your requests.");
  const ids = (data || []).map((p) => p.fan_id);
  const { data: names } = await db
    .from("profiles")
    .select("id,display_name")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data: creators } = await db
    .from("creator_profiles")
    .select("id,profiles(display_name)")
    .in(
      "id",
      (data || []).length
        ? (data || []).map((p) => p.creator_id)
        : ["00000000-0000-0000-0000-000000000000"],
    );
  return (data || []).map((p) => ({
    ...p,
    fanName: names?.find((n) => n.id === p.fan_id)?.display_name || "Member",
    creatorName:
      (
        creators?.find((c) => c.id === p.creator_id)?.profiles as unknown as {
          display_name: string;
        }
      )?.display_name || "your creator",
  }));
}
