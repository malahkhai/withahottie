export type StripeAccountRequirement = {
  awaiting_action_from?: string;
  minimum_deadline?: { status?: string };
};

export function payoutReadiness({
  transfersStatus,
  payoutsStatus,
  requirements = [],
}: {
  transfersStatus?: string;
  payoutsStatus?: string;
  requirements?: StripeAccountRequirement[];
}) {
  const transfers = transfersStatus === "active";
  const payouts = payoutsStatus === "active";
  const requirementsDue = requirements.some(
    (entry) =>
      entry.awaiting_action_from === "user" &&
      ["currently_due", "past_due"].includes(
        entry.minimum_deadline?.status || "",
      ),
  );

  // Stripe capability status is the authority for whether money can move.
  // Eventually-due requirements are informational and must not block an
  // otherwise active account.
  return { transfers, payouts, requirementsDue, ready: transfers && payouts };
}
