import { requireRole } from "@/lib/auth/session";
import { stripeConfig } from "@/lib/stripe/config";
import { paymentBackend } from "@/lib/stripe/server";
import { connectStatus } from "@/lib/stripe/connect";
import { PayoutSetup } from "@/components/payout-setup";
export const metadata = { title: "Payouts" };
export default async function Page() {
  const viewer = await requireRole(["creator", "admin"]);
  const enabled = !!stripeConfig();
  let status = {
    connected: false,
    ready: false,
    transfers: false,
    payouts: false,
    requirementsDue: true,
  };
  let error = false;
  if (enabled && !viewer.demo) {
    try {
      const { db } = paymentBackend();
      const { data } = await db
        .from("creator_profiles")
        .select("id")
        .eq("profile_id", viewer.id)
        .single();
      if (data) status = await connectStatus(data.id);
    } catch {
      error = true;
    }
  }
  return (
    <section className="settings-panel">
      <p className="eyebrow">YOUR PAYOUTS · TEST MODE</p>
      <h1>
        {status.ready
          ? "Payout account connected ✓"
          : status.connected
            ? "Finish your payout setup"
            : "Get paid with Stripe"}
      </h1>
      <p>Connect your payout account to start receiving ReplyPass earnings.</p>
      {error ? (
        <p role="alert">
          Payout status unavailable. Please retry before accepting paid
          requests.
        </p>
      ) : (
        <>
          <p>
            {status.ready
              ? "Your payout account is eligible for secured replies."
              : "Complete your payout setup before accepting paid requests."}
          </p>
          <p>
            Transfers: {status.transfers ? "Enabled" : "Not enabled"} · Payouts:{" "}
            {status.payouts ? "Enabled" : "Not enabled"}
          </p>
          <p>
            {status.requirementsDue
              ? "Stripe may need more information to complete onboarding."
              : "Onboarding requirements complete."}
          </p>
        </>
      )}
      {enabled && !viewer.demo ? (
        <PayoutSetup connected={status.connected} />
      ) : (
        <p className="demo-notice">
          Demo mode. Configure Stripe test credentials and Supabase to set up a
          test payout account.
        </p>
      )}
    </section>
  );
}
