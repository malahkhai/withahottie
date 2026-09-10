import type { InteractionKind, Offering, UserRole } from "./domain";
export const categories = [
  "Creator",
  "Model",
  "Athlete",
  "Musician",
  "Fitness",
  "Lifestyle",
  "Fashion",
  "Gaming",
  "Business",
  "Other",
] as const;
export type Availability = "online" | "away" | "offline";
export interface CreatorDraft {
  payoutReady?: boolean;
  displayName: string;
  username: string;
  image: string;
  bio: string;
  categories: string[];
  country: string;
  socials: Record<
    "instagram" | "tiktok" | "youtube" | "twitter" | "website",
    string
  >;
  pricing: { kind: InteractionKind; cents: number; enabled: boolean }[];
  currency: "eur";
  acceptingMessages: boolean;
  acceptingLive: boolean;
  acceptingMedia: boolean;
  availability: Availability;
  replyTime: string;
}
export interface PublicCreator {
  id: string;
  name: string;
  handle: string;
  bio: string;
  image: string;
  categories: string[];
  rating: string;
  responseRate: string;
  responseTime: string;
  completedChats: string;
  verified: boolean;
  availability: Availability;
  offerings: Offering[];
  vip: Offering | null;
  demo: boolean;
  socials: CreatorDraft["socials"];
}
export interface Viewer {
  id: string;
  role: UserRole;
  displayName: string;
  demo: boolean;
}
export type RequestState =
  "pending" | "accepted" | "completed" | "declined" | "expired";
export interface Fan {
  id: string;
  name: string;
  username: string;
  color: string;
  vip: boolean;
}
export interface CreatorRequest {
  creatorCents?: number;
  needsReconciliation?: boolean;
  conversationId?: string | null;
  id: string;
  fanId: string;
  kind: InteractionKind;
  body: string;
  amountCents: number;
  currency: string;
  status: RequestState;
  paymentStatus: string;
  expires_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  completed_at: string | null;
}
export interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  attachment?: string;
}
export interface Conversation {
  creatorHandle?: string;
  id: string;
  fanId: string;
  unread: number;
  messages: ChatMessage[];
  context: string;
}
export interface Subscriber {
  id: string;
  fanId: string;
  amountCents: number;
  status: string;
  renewsAt: string;
}
export interface WorkspaceData {
  demo: boolean;
  viewer: Viewer;
  creator: CreatorDraft;
  fans: Fan[];
  requests: CreatorRequest[];
  conversations: Conversation[];
  subscribers: Subscriber[];
  earnedToday: number;
  profileViews: number;
  revenue: number[];
}
