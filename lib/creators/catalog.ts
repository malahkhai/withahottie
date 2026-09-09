import type { CreatorDraft, PublicCreator } from "../../types/creator.ts";
import type { Offering } from "../../types/domain.ts";
export const catalog: Offering[] = [
  {
    kind: "message",
    title: "Message me",
    subtitle: "Guaranteed reply",
    cents: 400,
    icon: "message",
  },
  {
    kind: "live_chat",
    title: "Live chat",
    subtitle: "A conversation in real time",
    cents: 300,
    unit: "/min",
    icon: "bolt",
  },
  {
    kind: "voice_note",
    title: "Voice note",
    subtitle: "Personal reply",
    cents: 1000,
    icon: "mic",
  },
  {
    kind: "photo",
    title: "Photo request",
    subtitle: "Personalized request",
    cents: 1500,
    icon: "camera",
  },
  {
    kind: "video",
    title: "Video request",
    subtitle: "Up to 60 sec",
    cents: 3000,
    icon: "video",
  },
  {
    kind: "vip",
    title: "Become VIP",
    subtitle: "Basic messaging and private posts",
    cents: 1900,
    unit: "/month",
    icon: "sparkles",
  },
];
export const blankCreator: CreatorDraft = {
  displayName: "",
  username: "",
  image: "",
  bio: "",
  categories: ["Creator"],
  country: "FR",
  socials: { instagram: "", tiktok: "", youtube: "", twitter: "", website: "" },
  pricing: catalog.map((p) => ({
    kind: p.kind,
    cents: p.cents,
    enabled: true,
  })),
  currency: "eur",
  acceptingMessages: true,
  acceptingLive: true,
  acceptingMedia: true,
  availability: "online",
  replyTime: "~10 minutes",
};
export const stellaDraft: CreatorDraft = {
  ...blankCreator,
  displayName: "Stella May",
  username: "stella",
  image: "/images/stella.jpg",
  bio: "Come talk to me. I answer everything here.",
  categories: ["Lifestyle", "Fashion"],
  socials: { ...blankCreator.socials },
};
export function toPublic(d: CreatorDraft, demo = true): PublicCreator {
  const enabled = catalog
    .filter((item) => d.pricing.find((p) => p.kind === item.kind)?.enabled)
    .map((item) => ({
      ...item,
      cents: d.pricing.find((p) => p.kind === item.kind)!.cents,
    }));
  return {
    id: d.username,
    name: d.displayName,
    handle: "@" + d.username,
    bio: d.bio,
    image: d.image || "/images/avatar.svg",
    categories: d.categories,
    rating: "New",
    responseRate: "—",
    responseTime: d.replyTime || "Not set",
    completedChats: "0",
    verified: false,
    availability: d.availability,
    offerings: enabled.filter(
      (p) =>
        p.kind !== "vip" &&
        (p.kind === "message"
          ? d.acceptingMessages
          : p.kind === "live_chat"
            ? d.acceptingLive
            : d.acceptingMedia),
    ),
    vip: enabled.find((p) => p.kind === "vip") || null,
    demo,
    socials: d.socials,
  };
}
export const demoStella: PublicCreator = {
  ...toPublic(stellaDraft),
  verified: true,
  rating: "4.9",
  responseRate: "98%",
  responseTime: "~8 min",
  completedChats: "2.4K",
  categories: ["Lifestyle", "Fashion", "Travel"],
};
