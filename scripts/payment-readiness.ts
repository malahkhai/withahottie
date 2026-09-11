import fs from "node:fs";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripeConfigurationStatus } from "../lib/stripe/config.ts";
import { paymentEvents } from "../lib/stripe/events.ts";

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");

const configuration = stripeConfigurationStatus();
const report: Record<string, unknown> = { configuration };
let passed = configuration.ready;

if (
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const schemaChecks = {
    creator_stripe_accounts:
      "creator_id,stripe_account_id,ready,transfers_enabled,payouts_enabled,requirements_due",
    reply_payments:
      "id,request_id,interaction_id,stripe_payment_intent_id,stripe_charge_id,stripe_transfer_id,gross_cents,fee_cents,creator_cents,currency,authorized_at,accepted_at,captured_at,completed_at,transferred_at,declined_at,expired_at,manual_review",
    stripe_webhook_events: "id,event_type,attempts,processed_at",
  };
  const schema: Record<string, boolean> = {};
  for (const [table, columns] of Object.entries(schemaChecks)) {
    const { error } = await db.from(table).select(columns).limit(0);
    schema[table] = !error;
    passed &&= !error;
  }
  const [{ count: creators }, { count: fans }, { data: accounts }] =
    await Promise.all([
      db
        .from("creator_profiles")
        .select("id", { head: true, count: "exact" })
        .eq("onboarding_complete", true),
      db
        .from("profiles")
        .select("id", { head: true, count: "exact" })
        .eq("role", "fan"),
      db
        .from("creator_stripe_accounts")
        .select("ready,transfers_enabled,payouts_enabled"),
    ]);
  report.database = {
    schema,
    publishedCreators: creators || 0,
    fans: fans || 0,
    connectedAccounts: accounts?.length || 0,
    payoutReadyAccounts:
      accounts?.filter(
        (a) => a.ready && a.transfers_enabled && a.payouts_enabled,
      ).length || 0,
  };
}

if (configuration.secretKey === "test" && process.env.STRIPE_SECRET_KEY) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      maxNetworkRetries: 1,
      timeout: 15000,
    });
    await stripe.balance.retrieve();
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const expected = [...paymentEvents].sort();
    const destination = endpoints.data.find(
      (item) =>
        item.url === "https://getreplypass.com/api/stripe/webhook" ||
        item.url === "https://www.getreplypass.com/api/stripe/webhook",
    );
    const actual = destination?.enabled_events
      ? [...destination.enabled_events].sort()
      : [];
    const snapshotEventsExact =
      !!destination &&
      actual.length === expected.length &&
      actual.every((event, index) => event === expected[index]);
    report.stripe = {
      testKeyAccepted: true,
      snapshotWebhookPresent: !!destination,
      snapshotEventsExact,
      accountsV2WebhookSecretPresent:
        configuration.connectWebhookSecret === "configured",
    };
    passed &&= !!destination && snapshotEventsExact;
  } catch {
    report.stripe = { testKeyAccepted: false };
    passed = false;
  }
}

try {
  const response = await fetch("https://getreplypass.com/api/stripe/webhook", {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
  report.productionWebhook = {
    status: response.status,
    direct: response.status === 400,
    redirectsToWww: response.status >= 300 && response.status < 400,
  };
  passed &&= response.status === 400;
} catch {
  report.productionWebhook = { reachable: false };
  passed = false;
}

report.readyForHostedLifecycleTest = passed;
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exitCode = 1;
