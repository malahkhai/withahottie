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
        "id,fan_id,creator_id,kind,amount_cents,currency,status,created_at,captured_at,completed_at",
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
  const requestRows: CreatorRequest[] = (requests || []).map((r) => {
    const p = interactions!.find((p) => p.id === r.interaction_id)!;
    return {
      id: r.id,
      fanId: p.fan_id,
      kind: p.kind,
      body: r.body,
      amountCents: p.amount_cents,
      currency: p.currency,
      status: r.status === "fulfilled" ? "completed" : r.status,
      paymentStatus: p.status,
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
      unread: msgs.filter(
        (m) =>
          m.sender_id !== viewer.id && (!lastRead || m.created_at > lastRead),
      ).length,
      context: "Private conversation · Payments remain mocked",
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
      .reduce((sum, p) => sum + splitPayment(p.amount_cents).creatorCents, 0);
  });
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
    profileViews: 0,
    revenue,
  };
}
