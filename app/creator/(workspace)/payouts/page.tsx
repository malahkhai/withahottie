import { Icon } from "@/components/icon";
import { PayoutSetup } from "@/components/payout-setup";
import { requireRole } from "@/lib/auth/session";
import { connectStatus } from "@/lib/stripe/connect";
import { stripeConfig } from "@/lib/stripe/config";
import { paymentBackend } from "@/lib/stripe/server";

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
  let statusError = false;

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
      statusError = true;
    }
  }

  const heading = status.ready
    ? "You’re ready to get paid"
    : status.connected
      ? "Finish setting up payouts"
      : "Turn replies into earnings";

  return (
    <section className="payout-page">
      <header className="workspace-heading payout-heading">
        <div>
          <p className="eyebrow">PAYOUTS</p>
          <h1>{heading}</h1>
          <p>
            Connect with Stripe once, then receive your ReplyPass earnings
            securely.
          </p>
        </div>
        <span className="payout-mode-badge">
          <i /> Stripe test mode
        </span>
      </header>

      <div className="payout-layout">
        <article className="payout-hero-card">
          <div className="payout-card-topline">
            <span className="payout-icon">
              <Icon name={status.ready ? "check" : "shield"} size={24} />
            </span>
            <span
              className={`payout-state ${status.ready ? "ready" : "pending"}`}
            >
              {status.ready
                ? "Ready"
                : status.connected
                  ? "Action needed"
                  : "Not connected"}
            </span>
          </div>

          <div className="payout-card-copy">
            <p className="eyebrow">POWERED BY STRIPE</p>
            <h2>
              {status.ready
                ? "Your payout account is active."
                : "Set up your payout account."}
            </h2>
            <p>
              {status.ready
                ? "You can accept secured replies and receive your creator share."
                : "Stripe verifies your identity and sends earnings directly to your bank account."}
            </p>
          </div>

          {statusError ? (
            <div className="payout-alert" role="alert">
              <Icon name="close" size={18} />
              <span>
                We couldn’t refresh your payout status. You can safely try
                again.
              </span>
            </div>
          ) : (
            <div className="payout-status-grid" aria-label="Payout status">
              <div>
                <span>Transfers</span>
                <strong>
                  <i className={status.transfers ? "active" : ""} />
                  {status.transfers ? "Enabled" : "Pending"}
                </strong>
              </div>
              <div>
                <span>Bank payouts</span>
                <strong>
                  <i className={status.payouts ? "active" : ""} />
                  {status.payouts ? "Enabled" : "Pending"}
                </strong>
              </div>
            </div>
          )}

          {enabled && !viewer.demo ? (
            status.ready ? (
              <div className="payout-ready-note">
                <Icon name="check" size={18} />
                <span>
                  <strong>Payout setup complete</strong>
                  Guaranteed Reply is enabled on your creator profile.
                </span>
              </div>
            ) : (
              <PayoutSetup connected={status.connected} />
            )
          ) : (
            <p className="demo-notice payout-demo-notice">
              Demo mode is active. Add Stripe test credentials and Supabase to
              try payout onboarding.
            </p>
          )}
        </article>

        <aside className="payout-guide-card">
          <p className="eyebrow">WHAT TO EXPECT</p>
          <h2>A quick, secure setup.</h2>
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>Confirm your details</strong>
                <p>Stripe will ask about you and your creator activity.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Add your payout account</strong>
                <p>Your bank information is handled directly by Stripe.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Start accepting replies</strong>
                <p>
                  Guaranteed Reply unlocks when Stripe approves your account.
                </p>
              </div>
            </li>
          </ol>
        </aside>
      </div>

      <div className="payout-trust-row">
        <div>
          <Icon name="shield" size={20} />
          <span>
            <strong>Your details stay protected</strong>
            ReplyPass never stores your bank login or card details.
          </span>
        </div>
        <div>
          <span className="payout-fee">85%</span>
          <span>
            <strong>Your creator share</strong>
            ReplyPass keeps a 15% platform fee from completed requests.
          </span>
        </div>
      </div>
    </section>
  );
}
