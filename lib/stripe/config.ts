export function stripeConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const secret = env.STRIPE_SECRET_KEY;
  const publishable = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const webhook = env.STRIPE_WEBHOOK_SECRET;
  if (!secret && !publishable && !webhook && !env.STRIPE_CONNECT_WEBHOOK_SECRET)
    return null;
  if (
    env.STRIPE_CONNECT_WEBHOOK_SECRET &&
    !env.STRIPE_CONNECT_WEBHOOK_SECRET.startsWith("whsec_")
  )
    throw Error("Invalid Connect webhook configuration.");
  if (
    !secret?.startsWith("sk_test_") ||
    !publishable?.startsWith("pk_test_") ||
    !webhook?.startsWith("whsec_")
  )
    throw Error(
      "Stripe test configuration is incomplete or invalid. Live payments are disabled.",
    );
  if (
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw Error("Stripe test payments require a configured Supabase backend.");
  const seconds = Number(env.REPLY_EXPIRY_SECONDS || 86400);
  if (!Number.isSafeInteger(seconds) || seconds < 30 || seconds > 86400)
    throw Error("Reply expiry must be between 30 seconds and 24 hours.");
  return { secret, publishable, webhook, expirySeconds: seconds };
}

type Shape =
  | "missing"
  | "test"
  | "configured"
  | "invalid"
  | "live-rejected";
function keyShape(value: string | undefined, testPrefix: string): Shape {
  if (!value) return "missing";
  if (value.startsWith(testPrefix)) return "test";
  if (value.startsWith(testPrefix.replace("test", "live")))
    return "live-rejected";
  return "invalid";
}
/** Safe to show to an authenticated operator: values and identifiers are never returned. */
export function stripeConfigurationStatus(
  env: Record<string, string | undefined> = process.env,
) {
  const publishableKey = keyShape(
    env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    "pk_test_",
  );
  const secretKey = keyShape(env.STRIPE_SECRET_KEY, "sk_test_");
  const webhookSecret: Shape = !env.STRIPE_WEBHOOK_SECRET
    ? "missing"
    : env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")
      ? "configured"
      : "invalid";
  const connectWebhookSecret: Shape = !env.STRIPE_CONNECT_WEBHOOK_SECRET
    ? "missing"
    : env.STRIPE_CONNECT_WEBHOOK_SECRET.startsWith("whsec_")
      ? "configured"
      : "invalid";
  const cronSecret =
    !env.CRON_SECRET || env.CRON_SECRET.length < 32 ? "missing" : "configured";
  return {
    publishableKey,
    secretKey,
    webhookSecret,
    connectWebhookSecret,
    cronSecret,
    supabase: {
      url: !!env.NEXT_PUBLIC_SUPABASE_URL,
      anonymousKey: !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceRoleKey: !!env.SUPABASE_SERVICE_ROLE_KEY,
    },
    ready:
      publishableKey === "test" &&
      secretKey === "test" &&
      webhookSecret === "configured" &&
      connectWebhookSecret === "configured" &&
      cronSecret === "configured" &&
      !!env.NEXT_PUBLIC_SUPABASE_URL &&
      !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !!env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
