import "server-only";
import { paymentBackend } from "./server";
import { authOrigin } from "@/lib/site";

export type ConnectOnboardingStage =
  | "load_creator"
  | "initialize_record"
  | "load_record"
  | "create_account"
  | "save_account"
  | "create_account_link";

export class ConnectOnboardingError extends Error {
  constructor(
    public readonly stage: ConnectOnboardingStage,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ConnectOnboardingError";
  }
}

async function atStage<T>(
  stage: ConnectOnboardingStage,
  operation: () => PromiseLike<T>,
) {
  try {
    return await operation();
  } catch (cause) {
    throw new ConnectOnboardingError(stage, "Stripe payout setup failed.", {
      cause,
    });
  }
}
export async function connectStatus(creatorId: string) {
  const { stripe, db } = paymentBackend();
  const { data: row, error } = await db
    .from("creator_stripe_accounts")
    .select("*")
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (error) throw Error("Payout status unavailable.");
  if (!row?.stripe_account_id)
    return {
      connected: false,
      ready: false,
      transfers: false,
      payouts: false,
      requirementsDue: true,
    };
  const account = await stripe.v2.core.accounts.retrieve(
    row.stripe_account_id,
    { include: ["configuration.recipient", "requirements"] },
  );
  const balances =
    account.configuration?.recipient?.capabilities?.stripe_balance;
  const transfers = balances?.stripe_transfers?.status === "active";
  const payouts = balances?.payouts?.status === "active";
  const requirementsDue = !!account.requirements?.entries?.some(
    (e) => e.awaiting_action_from === "user",
  );
  const ready = transfers && payouts && !requirementsDue;
  const { error: updateError } = await db
    .from("creator_stripe_accounts")
    .update({
      ready,
      transfers_enabled: transfers,
      payouts_enabled: payouts,
      requirements_due: requirementsDue,
      updated_at: new Date().toISOString(),
    })
    .eq("creator_id", creatorId);
  if (updateError) throw Error("Could not save payout status.");
  return { connected: true, ready, transfers, payouts, requirementsDue };
}
export async function onboardConnect(userId: string, origin: string) {
  const { stripe, db } = paymentBackend();
  const { data: creator, error } = await atStage("load_creator", () =>
    db
      .from("creator_profiles")
      .select("id,country")
      .eq("profile_id", userId)
      .single(),
  );
  if (error || !creator) throw Error("Create your creator profile first.");
  const { error: initError } = await atStage("initialize_record", () =>
    db
      .from("creator_stripe_accounts")
      .upsert(
        { creator_id: creator.id },
        { onConflict: "creator_id", ignoreDuplicates: true },
      ),
  );
  if (initError) throw Error("Payout setup unavailable.");
  const { data: row, error: rowError } = await atStage("load_record", () =>
    db
      .from("creator_stripe_accounts")
      .select("*")
      .eq("creator_id", creator.id)
      .single(),
  );
  if (rowError) throw Error("Payout setup unavailable.");
  let accountId = row?.stripe_account_id as string | undefined;
  if (!accountId) {
    if (!row || Date.now() - Date.parse(row.created_at) > 23 * 3600000)
      throw Error("Payout setup needs reconciliation. Contact support.");
    const account = await atStage("create_account", () =>
      stripe.v2.core.accounts.create(
        {
          dashboard: "express",
          identity: { country: creator.country },
          configuration: {
            recipient: {
              capabilities: {
                stripe_balance: { stripe_transfers: { requested: true } },
              },
            },
          },
          defaults: {
            responsibilities: {
              fees_collector: "application",
              losses_collector: "application",
            },
          },
          metadata: { creator_id: creator.id },
        },
        { idempotencyKey: `replypass:account:${creator.id}` },
      ),
    );
    accountId = account.id;
    const { error: saveError } = await atStage("save_account", () =>
      db
        .from("creator_stripe_accounts")
        .update({ stripe_account_id: accountId })
        .eq("creator_id", creator.id),
    );
    if (saveError)
      throw Error("Payout setup is pending reconciliation. Retry this setup.");
  }
  const base = authOrigin(origin);
  const link = await atStage("create_account_link", () =>
    stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          refresh_url: `${base}/creator/payouts?refresh=1`,
          return_url: `${base}/creator/payouts?returned=1`,
        },
      },
    }),
  );
  return link.url;
}
