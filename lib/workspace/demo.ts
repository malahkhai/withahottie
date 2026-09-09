import { stellaDraft } from "../creators/catalog";
import type { WorkspaceData, CreatorRequest } from "../../types/creator";
export function demoWorkspace(name = "Stella May"): WorkspaceData {
  const now = Date.now();
  const ago = (m: number) => new Date(now - m * 60000).toISOString();
  const fans = [
    ["alex", "Alex Morgan", "alexm", "sage"],
    ["jordan", "Jordan Ellis", "jordan.e", "blue"],
    ["sam", "Sam Rivera", "samr", "sand"],
    ["noor", "Noor Bennett", "noorb", "rose"],
    ["leo", "Leo Chen", "leoc", "lilac"],
  ].map(([id, name, username, color], i) => ({
    id,
    name,
    username,
    color,
    vip: i === 1 || i === 3,
  }));
  const requests: CreatorRequest[] = fans.map((fan, i) => ({
    id: "request-" + fan.id,
    fanId: fan.id,
    kind: (["message", "voice_note", "photo", "live_chat", "video"] as const)[
      i
    ],
    body: [
      "I’m planning my first solo trip. Any advice for finding the confidence to go?",
      "A little birthday encouragement would make my week!",
      "Could you share your favorite outfit for a city weekend?",
      "Would love to talk about balancing work and travel.",
      "Can you record a quick hello for my graduation?",
    ][i],
    amountCents: [400, 1000, 1500, 1500, 3000][i],
    currency: "eur",
    status: "pending",
    paymentStatus: "authorized",
    expires_at: new Date(
      now + [462, 1080, 2400, 3600, 5400][i] * 1000,
    ).toISOString(),
    accepted_at: null,
    declined_at: null,
    completed_at: null,
  }));
  requests.push({
    ...requests[0],
    id: "completed-alex",
    status: "completed",
    body: "Thanks for the packing advice!",
    completed_at: ago(110),
    accepted_at: ago(130),
    expires_at: ago(60),
  });
  requests.push({
    ...requests[1],
    id: "accepted-jordan",
    status: "accepted",
    accepted_at: ago(5),
    expires_at: ago(-40),
  });
  requests.push({
    ...requests[2],
    id: "expired-sam",
    status: "expired",
    expires_at: ago(10),
  });
  return {
    demo: true,
    viewer: {
      id: "demo-creator",
      role: "creator",
      displayName: name,
      demo: true,
    },
    creator: stellaDraft,
    fans,
    requests,
    conversations: fans.map((fan, i) => ({
      id: "chat-" + fan.id,
      fanId: fan.id,
      unread: i < 3 ? 1 : 0,
      context: fan.vip
        ? "VIP member · €19/month"
        : "Guaranteed reply · €4 authorized",
      messages: [
        {
          id: "hello-" + fan.id,
          senderId: fan.id,
          body: requests[i].body,
          createdAt: ago(20 + i * 10),
        },
        {
          id: "reply-" + fan.id,
          senderId: "demo-creator",
          body:
            i === 0
              ? "Absolutely. Start with a place that makes you curious, and give yourself room to explore."
              : "Thanks for being here! What would you like to know?",
          createdAt: ago(15 + i * 10),
        },
        {
          id: "latest-" + fan.id,
          senderId: fan.id,
          body: [
            "That’s exactly what I needed to hear. Thank you!",
            "I’ve been following your travels for a while!",
            "Love the new photos. Where was that?",
            "I’d love to hear how you got started.",
            "Looking forward to chatting!",
          ][i],
          createdAt: ago(i * 7 + 1),
        },
      ],
    })),
    subscribers: fans
      .filter((f) => f.vip)
      .map((f) => ({
        id: "sub-" + f.id,
        fanId: f.id,
        amountCents: 1900,
        status: "active",
        renewsAt: ago(-43200),
      })),
    earnedToday: 12800,
    profileViews: 386,
    revenue: [4200, 6800, 5100, 9200, 7600, 11200, 12800],
  };
}
