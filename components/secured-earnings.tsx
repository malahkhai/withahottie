import { Price } from "./ui";
import type { paymentSummaries } from "@/lib/stripe/summaries";
export function SecuredEarnings({
  rows,
}: {
  rows: Awaited<ReturnType<typeof paymentSummaries>>;
}) {
  return (
    <section>
      <p className="eyebrow">STRIPE TEST MODE</p>
      <h1>Your earnings.</h1>
      <p>
        Reserved funds are potential earnings. Earnings are recorded only after
        a qualifying reply is captured. Showing the latest 100 requests;
        payments under review are excluded from totals.
      </p>
      {["eur", "usd", "gbp"].map((currency) => {
        const list = rows.filter(
          (p) => p.currency === currency && !p.manual_review,
        );
        if (!list.length) return null;
        return (
          <div key={currency} className="settings-panel">
            <p>
              Potential:{" "}
              <Price
                currency={currency}
                cents={list
                  .filter((p) => p.payment_state === "authorized")
                  .reduce((n, p) => n + p.creator_cents, 0)}
                decimals
              />
            </p>
            <p>
              Completed:{" "}
              <Price
                currency={currency}
                cents={list
                  .filter((p) => p.payment_state === "captured")
                  .reduce((n, p) => n + p.creator_cents, 0)}
                decimals
              />
            </p>
            <p>
              Transferred:{" "}
              <Price
                currency={currency}
                cents={list
                  .filter(
                    (p) =>
                      p.payment_state === "captured" &&
                      p.transfer_state === "transferred",
                  )
                  .reduce((n, p) => n + p.creator_cents, 0)}
                decimals
              />
            </p>
          </div>
        );
      })}
      {rows.map((p) => (
        <article className="request-card" key={p.id}>
          <h2>{p.fanName} · Guaranteed reply</h2>
          <p>
            {p.payment_state === "authorized" ? "Secured" : "Fan amount"}{" "}
            <Price cents={p.gross_cents} currency={p.currency} decimals />
          </p>
          <p>
            ReplyPass{" "}
            <Price cents={p.fee_cents} currency={p.currency} decimals />
          </p>
          <p>
            {p.manual_review
              ? "Amount under review"
              : p.payment_state === "captured"
                ? "You earned"
                : "Potential earnings"}{" "}
            <Price cents={p.creator_cents} currency={p.currency} decimals />
          </p>
          <p>
            {p.payment_state === "captured"
              ? "Completed"
              : p.payment_state === "authorized"
                ? "Waiting for reply"
                : p.payment_state}{" "}
            ·{" "}
            {p.transfer_state === "transferred"
              ? "Transferred"
              : p.transfer_state === "pending"
                ? "Transfer pending"
                : p.transfer_state === "failed"
                  ? "Transfer needs attention"
                  : ""}
          </p>
          {p.needs_reconciliation && (
            <p>
              Payment status needs review. Any submitted reply is safely saved.
            </p>
          )}
        </article>
      ))}
      {!rows.length && <p>No completed earnings yet.</p>}
    </section>
  );
}
