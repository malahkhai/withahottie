import "server-only";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripeConfig } from "./config";
export function paymentBackend() {
  const config = stripeConfig();
  if (!config) throw Error("Stripe test payments are not configured.");
  return {
    config,
    stripe: new Stripe(config.secret, { maxNetworkRetries: 2, timeout: 20000 }),
    db: serviceDatabase(),
  };
}
export function serviceDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error("Server database configuration is required.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
