import type { InteractionKind } from "../../types/domain.ts";
const prices: Record<InteractionKind, number> = {
  message: 400,
  live_chat: 300,
  voice_note: 1000,
  photo: 1500,
  video: 3000,
  vip: 1900,
};
export function demoQuote(input: unknown, serverPrice?: number) {
  if (!input || typeof input !== "object") return null;
  const { kind, message, minutes } = input as Record<string, unknown>;
  if (typeof kind !== "string" || !Object.hasOwn(prices, kind)) return null;
  if (typeof message !== "string" || message.length > 2000) return null;
  if (kind !== "vip" && !message.trim()) return null;
  if (
    kind === "live_chat" &&
    (typeof minutes !== "number" ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > 30)
  )
    return null;
  const duration = kind === "live_chat" ? (minutes as number) : 1;
  return {
    mode: "demo" as const,
    amountCents: (serverPrice ?? prices[kind as InteractionKind]) * duration,
    currency: "eur" as const,
    charged: false as const,
  };
}
