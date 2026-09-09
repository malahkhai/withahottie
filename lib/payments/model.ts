import type { PaymentStatus } from "../../types/domain.ts";
// Trusted server workers only. The browser never writes financial state.
export const transitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ["authorized", "declined", "expired"],
  authorized: ["accepted", "declined", "expired"],
  accepted: ["captured", "declined", "expired"],
  captured: ["completed", "refunded", "disputed"],
  completed: ["refunded", "disputed"],
  declined: [],
  expired: [],
  refunded: ["disputed"],
  disputed: ["refunded", "captured", "completed"],
};
export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return transitions[from].includes(to);
}
