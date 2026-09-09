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
/** ISO currency identifiers are normalized to lowercase at the database/API boundary. */
export type Currency = "eur" | "usd" | "gbp";
export interface PaidInteraction {
  id: string;
  fanId: string;
  creatorId: string;
  kind: InteractionKind;
  amountCents: number;
  currency: Currency;
  status: PaymentStatus;
  stripePaymentIntentId: string | null;
  expiresAt: string | null;
  expires_at?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
  completed_at?: string | null;
}
export interface Offering {
  kind: InteractionKind;
  title: string;
  subtitle: string;
  cents: number;
  icon: string;
  unit?: string;
}
