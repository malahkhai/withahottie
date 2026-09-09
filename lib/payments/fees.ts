export const PLATFORM_FEE_BPS = 1500;
export const PLATFORM_FEE_PERCENT = PLATFORM_FEE_BPS / 100;
export const CREATOR_SHARE_PERCENT = 100 - PLATFORM_FEE_PERCENT;
export function splitPayment(amountCents: number, feeBps = PLATFORM_FEE_BPS) {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents < 0 ||
    !Number.isInteger(feeBps) ||
    feeBps < 0 ||
    feeBps > 10000
  )
    throw new Error("Invalid money value");
  const platformCents = Math.round((amountCents * feeBps) / 10000);
  return {
    fanCents: amountCents,
    platformCents,
    creatorCents: amountCents - platformCents,
  };
}
