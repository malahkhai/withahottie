import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { stripeConfig } from "@/lib/stripe/config";
import { paymentSummaries } from "@/lib/stripe/summaries";
import { FanRequestCard } from "@/components/fan-request-card";
import { Icon } from "@/components/icon";
export const metadata = {
  title: "Your requests",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const viewer = await requireRole(["fan", "creator", "admin"]);
  const rows =
    !viewer.demo && stripeConfig()
      ? await paymentSummaries(viewer.id, "fan")
      : [];
  const activeCount = rows.filter(
    (request) => request.payment_state === "authorized",
  ).length;
  const repliedCount = rows.filter(
    (request) => request.payment_state === "captured",
  ).length;
  return (
    <main id="main" className="fan-account fan-requests-page">
      <section className="fan-requests-heading">
        <div>
          <span className="eyebrow">YOUR REQUESTS</span>
          <h1>Every reply, in one place.</h1>
          <p>Follow each request from reservation to reply.</p>
        </div>
        <div className="fan-promise">
          <Icon name="shield" size={18} />
          <span>
            <strong>No reply</strong>
            No charge
          </span>
        </div>
      </section>
      {!!rows.length && (
        <div className="fan-request-summary" aria-label="Request summary">
          <div>
            <strong>{activeCount}</strong>
            <span>Active</span>
          </div>
          <div>
            <strong>{repliedCount}</strong>
            <span>Replied</span>
          </div>
          <p>
            Your bank may show a temporary hold while a reply is pending. It is
            only captured when the creator replies.
          </p>
        </div>
      )}
      <section className="fan-request-list" aria-label="Secured requests">
        {rows.map((request) => (
          <FanRequestCard key={request.id} request={request} />
        ))}
      </section>
      {!rows.length && (
        <div className="fan-requests-empty">
          <span className="fan-requests-empty-icon">
            <Icon name="message" size={28} />
          </span>
          <h2>Your first conversation starts with a creator.</h2>
          <p>
            {viewer.demo
              ? "Sign in with Supabase to track real secured requests."
              : "Requests will appear here after you ask a creator for a guaranteed reply."}
          </p>
          <Link className="button button-primary" href="/">
            Back to ReplyPass <Icon name="arrow" size={17} />
          </Link>
        </div>
      )}
      <aside className="fan-request-trust">
        <Icon name="lock" size={20} />
        <div>
          <strong>Your payment stays protected.</strong>
          <p>
            ReplyPass uses Stripe to reserve the price. A creator’s reply is
            what completes the charge.
          </p>
        </div>
      </aside>
    </main>
  );
}
