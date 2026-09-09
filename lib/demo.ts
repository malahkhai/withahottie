import type { Offering } from "@/types/domain";
export const stella = {
  name: "Stella May",
  handle: "@stella",
  bio: "Come talk to me 💕 I answer everything here.",
  image: "/images/stella.jpg",
  categories: ["Lifestyle", "Fashion", "Travel"],
  rating: "4.9",
  responseRate: "98%",
  responseTime: "~8 min",
  completedChats: "2.4K",
};
export const offerings: Offering[] = [
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
    subtitle: "A little time, just us",
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
];
export const vip: Offering = {
  kind: "vip",
  title: "Become VIP",
  subtitle: "Unlimited/basic messaging and private posts",
  cents: 1900,
  unit: "/month",
  icon: "sparkles",
};
