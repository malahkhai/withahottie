import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { stripeConfig } from "@/lib/stripe/config";
import { paymentSummaries } from "@/lib/stripe/summaries";
import { Price } from "@/components/ui";
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
  return (
    <main id="main" className="fan-account">
      <h1>Your requests.</h1>
      <p>No reply = no charge.</p>
      {rows.map((p) => (
        <article key={p.id} className="request-card">
          <h2>
            {p.payment_state === "captured"
              ? "Replied ✓"
              : p.payment_state === "canceled"
                ? p.declined_at
                  ? "Declined"
                  : "Expired"
                : p.payment_state === "refunded"
                  ? "Refunded"
                  : p.payment_state === "disputed"
                    ? "Payment under review"
                    : p.accepted_at
                      ? "Accepted"
                      : p.payment_state === "authorized"
                        ? `Waiting for ${p.creatorName}`
                        : "Reservation not completed"}
          </h2>
          {p.needs_reconciliation ? (
            <p>
              We’re checking this payment. Your messages are saved; please don’t
              submit another payment.
            </p>
          ) : (
            <p>
              <Price cents={p.gross_cents} currency={p.currency} decimals />{" "}
              {p.payment_state === "captured"
                ? "was charged after your creator replied."
                : p.payment_state === "authorized"
                  ? p.accepted_at
                    ? "is reserved. Your creator accepted; you’re only charged when they reply."
                    : "is reserved on your payment method. You haven’t been charged."
                  : p.payment_state === "canceled"
                    ? "was not charged. Your bank may take time to remove the pending hold."
                    : "— check the latest payment status before starting another request."}
            </p>
          )}
          {p.expires_at && (
            <p>
              Reply deadline: {new Date(p.expires_at).toLocaleString("en-GB")}
            </p>
          )}
          {p.conversation_id && <Link href="/account">Open messages</Link>}
        </article>
      ))}
      {!rows.length && (
        <div className="workspace-empty">
          <h2>No secured requests yet.</h2>
          <p>
            {viewer.demo
              ? "Demo requests remain available in your account."
              : "Your requests appear here once you start a reservation."}
          </p>
          <Link href="/account">View account</Link>
        </div>
      )}
      <Link href="/@stella">Discover creators</Link>
    </main>
  );
}
