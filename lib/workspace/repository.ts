import { stripeConfig } from "@/lib/stripe/config";
import { paymentBackend } from "@/lib/stripe/server";
import type { ReplyPayment } from "@/lib/stripe/engine";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { creatorForUser } from "@/lib/creators/repository";
import { demoCreator } from "@/lib/auth/demo";
import { demoWorkspace } from "./demo";
import { blankCreator } from "@/lib/creators/catalog";
import { splitPayment } from "@/lib/payments/fees";
import type { Viewer, WorkspaceData, CreatorRequest } from "@/types/creator";
export async function loadWorkspace(viewer: Viewer): Promise<WorkspaceData> {
  if (viewer.demo) {
    const data = demoWorkspace(viewer.displayName);
    return { ...data, viewer, creator: await demoCreator() };
  }
  const supabase = (await createClient())!;
  const [
    { data: members, error: memberError },
    { data: interactions, error: paymentError },
    { data: subscriptions, error: subError },
  ] = await Promise.all([
    supabase
      .from("conversation_members")
      .select("conversation_id,last_read_at")
      .eq("profile_id", viewer.id),
    supabase
      .from("paid_interactions")
      .select(
        "id,fan_id,creator_id,kind,amount_cents,currency,status,created_at,captured_at,completed_at,fee_cents,creator_cents,conversation_id",
      ),
    supabase
      .from("subscriptions")
      .select("id,fan_id,creator_id,amount_cents,status,current_period_end"),
  ]);
  if (memberError || paymentError || subError)
    throw Error("Your workspace could not be loaded. Please try again.");
  const conversationIds = (members || []).map((m) => m.conversation_id);
  const interactionIds = (interactions || []).map((p) => p.id);
  const [
    { data: allMembers, error: amError },
    { data: messages, error: messageError },
    { data: requests, error: requestError },
  ] = await Promise.all([
    conversationIds.length
      ? supabase
          .from("conversation_members")
          .select("conversation_id,profile_id")
          .in("conversation_id", conversationIds)
      : Promise.resolve({ data: [], error: null }),
    conversationIds.length
      ? supabase
          .from("messages")
          .select("id,conversation_id,sender_id,body,created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
    interactionIds.length
      ? supabase
          .from("interaction_requests")
          .select("*")
          .in("interaction_id", interactionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (amError || messageError || requestError)
    throw Error("Your conversations could not be loaded.");
  const ids = [
    ...new Set([
      ...(allMembers || []).map((m) => m.profile_id),
      ...(interactions || []).map((p) => p.fan_id),
      ...(subscriptions || []).map((s) => s.fan_id),
    ]),
  ].filter((id) => id !== viewer.id);
  const { data: profiles, error: profileError } = ids.length
    ? await supabase.from("profiles").select("id,display_name").in("id", ids)
    : { data: [], error: null };
  if (profileError) throw Error("Could not load conversation participants.");
  const fans = (profiles || []).map((p, i) => ({
    id: p.id,
    name: p.display_name,
    username: p.display_name.toLowerCase().replace(/\s+/g, "."),
    color: ["sage", "blue", "sand", "rose", "lilac"][i % 5],
    vip: (subscriptions || []).some(
      (s) => s.fan_id === p.id && s.status === "active",
    ),
  }));
  let secured: ReplyPayment[] = [];
  if (stripeConfig() && interactionIds.length) {
    const { data, error } = await paymentBackend()
      .db.from("reply_payments")
      .select("*")
      .in("interaction_id", interactionIds);
    if (error) throw Error("Payment context unavailable.");
    secured = data || [];
  }
  const requestRows: CreatorRequest[] = (requests || []).map((r) => {
    const p = interactions!.find((p) => p.id === r.interaction_id)!;
    return {
      id: r.id,
      fanId: p.fan_id,
      kind: p.kind,
      body: r.body,
      amountCents: p.amount_cents,
      creatorCents: p.creator_cents ?? undefined,
      conversationId: p.conversation_id,
      currency: p.currency,
      status: r.status === "fulfilled" ? "completed" : r.status,
      paymentStatus:
        secured.find((x) => x.interaction_id === p.id)?.payment_state ||
        p.status,
      needsReconciliation:
        secured.find((x) => x.interaction_id === p.id)?.needs_reconciliation ||
        false,
      expires_at: r.expires_at,
      accepted_at: r.accepted_at,
      declined_at: r.declined_at,
      completed_at: r.completed_at,
    };
  });
  const messageIds = (messages || []).map((m) => m.id);
  const { data: media, error: mediaError } = messageIds.length
    ? await supabase
        .from("media")
        .select("message_id,storage_path")
        .in("message_id", messageIds)
    : { data: [], error: null };
  if (mediaError) throw Error("Could not load attachments.");
  const attachmentUrls = new Map<string, string>();
  await Promise.all(
    (media || []).map(async (m) => {
      const { data, error } = await supabase.storage
        .from("chat-attachments")
        .createSignedUrl(m.storage_path, 300);
      if (!error && data) attachmentUrls.set(m.message_id, data.signedUrl);
    }),
  );
  const participantIds = [
    ...new Set((allMembers || []).map((m) => m.profile_id)),
  ];
  const { data: participantCreators } = participantIds.length
    ? await supabase
        .from("creator_profiles")
        .select("profile_id,handle")
        .in("profile_id", participantIds)
        .eq("onboarding_complete", true)
    : { data: [] };
  const conversations = conversationIds.map((id) => {
    const other = allMembers?.find(
      (m) => m.conversation_id === id && m.profile_id !== viewer.id,
    );
    const msgs = (messages || []).filter((m) => m.conversation_id === id);
    const lastRead = members?.find(
      (m) => m.conversation_id === id,
    )?.last_read_at;
    return {
      id,
      fanId: other?.profile_id || viewer.id,
      creatorHandle: participantCreators?.find((c) =>
        allMembers?.some(
          (m) => m.conversation_id === id && m.profile_id === c.profile_id,
        ),
      )?.handle,
      unread: msgs.filter(
        (m) =>
          m.sender_id !== viewer.id && (!lastRead || m.created_at > lastRead),
      ).length,
      context: (() => {
        const p = secured.find((p) => p.conversation_id === id);
        if (!p) return "Private conversation";
        const money = (cents: number) =>
          new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: p.currency,
          }).format(cents / 100);
        if (p.needs_reconciliation)
          return "Reply saved · Payment being checked";
        return p.payment_state === "captured"
          ? `Reply completed · ${money(p.creator_cents)} earned`
          : p.payment_state === "authorized"
            ? `${money(p.gross_cents)} secured · Reply to earn ${money(p.creator_cents)}`
            : "Reservation released or under review";
      })(),
      messages: msgs.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        body: m.body,
        createdAt: m.created_at,
        attachment: attachmentUrls.get(m.id),
      })),
    };
  });
  const settled = (interactions || []).filter((p) =>
    ["captured", "completed"].includes(p.status),
  );
  const revenue = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.now() - (6 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
    return settled
      .filter((p) =>
        (p.captured_at || p.completed_at || p.created_at).startsWith(day),
      )
      .reduce(
        (sum, p) =>
          sum + (p.creator_cents ?? splitPayment(p.amount_cents).creatorCents),
        0,
      );
  });
  let profileViews = 0;
  const { data: ownedCreator, error: creatorLookupError } = await supabase
    .from("creator_profiles")
    .select("id")
    .eq("profile_id", viewer.id)
    .maybeSingle();
  if (creatorLookupError) throw Error("Could not load profile analytics.");
  if (ownedCreator) {
    const since = new Date(Date.now() - 6 * 86400000)
      .toISOString()
      .slice(0, 10);
    const { data: viewDays, error: viewsError } = await supabase
      .from("creator_profile_view_days")
      .select("view_count")
      .eq("creator_id", ownedCreator.id)
      .gte("viewed_on", since);
    if (viewsError) throw Error("Could not load profile analytics.");
    profileViews = (viewDays || []).reduce(
      (total, day) => total + Number(day.view_count),
      0,
    );
  }
  return {
    demo: false,
    viewer,
    creator: (await creatorForUser(viewer.id)) || {
      ...blankCreator,
      displayName: viewer.displayName,
    },
    fans,
    requests: requestRows,
    conversations,
    subscribers: (subscriptions || []).map((s) => ({
      id: s.id,
      fanId: s.fan_id,
      amountCents: s.amount_cents,
      status: s.status,
      renewsAt: s.current_period_end || "",
    })),
    earnedToday: revenue[6],
    profileViews,
    revenue,
  };
}
