export type UserRole = "fan" | "creator" | "admin";
export type InteractionKind =
  "message" | "live_chat" | "voice_note" | "photo" | "video" | "vip";
export const paymentStatuses = [
  "pending",
  "authorized",
  "accepted",
  "captured",
  "completed",
  "declined",
  "expired",
  "refunded",
  "disputed",
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];
export interface PaidInteraction {
  id: string;
  fanId: string;
  creatorId: string;
  kind: InteractionKind;
  amountCents: number;
  currency: "eur";
  status: PaymentStatus;
  stripePaymentIntentId: string | null;
  expiresAt: string | null;
}
export interface Offering {
  kind: InteractionKind;
  title: string;
  subtitle: string;
  cents: number;
  icon: string;
  unit?: string;
}
