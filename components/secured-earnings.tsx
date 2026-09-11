import Link from "next/link";
import { Icon } from "./icon";
import { Price } from "./ui";
import type { paymentSummaries } from "@/lib/stripe/summaries";

type Rows = Awaited<ReturnType<typeof paymentSummaries>>;

function total(
  rows: Rows,
  predicate: (row: Rows[number]) => boolean,
) {
  return rows.filter(predicate).reduce((sum, row) => sum + row.creator_cents, 0);
}

function statusLabel(row: Rows[number]) {
  if (row.manual_review) return "Under review";
  if (row.payment_state === "authorized") return "Reply pending";
  if (row.payment_state === "captured" && row.transfer_state === "transferred")
    return "Paid out";
  if (row.payment_state === "captured") return "Earned";
  return row.payment_state.replaceAll("_", " ");
}

export function SecuredEarnings({ rows }: { rows: Rows }) {
  const visible = rows.filter((row) => !row.manual_review);
  const currencies = Array.from(new Set(visible.map((row) => row.currency)));
  const groups = currencies.length ? currencies : ["eur"];

  return (
    <section className="secured-earnings-page">
      <header className="workspace-heading earnings-heading">
        <div>
          <p className="eyebrow">YOUR EARNINGS</p>
          <h1>Clear numbers. Every reply.</h1>
          <p>
            Track secured requests, completed earnings, and payouts in one
            place.
          </p>
        </div>
        <span className="payout-mode-badge">
          <i /> Stripe test mode
        </span>
      </header>

      {groups.map((currency) => {
        const list = visible.filter((row) => row.currency === currency);
        const reserved = total(
          list,
          (row) => row.payment_state === "authorized",
        );
        const earned = total(
          list,
          (row) => row.payment_state === "captured",
        );
        const transferred = total(
          list,
          (row) =>
            row.payment_state === "captured" &&
            row.transfer_state === "transferred",
        );

        return (
          <div className="earnings-currency-section" key={currency}>
            {groups.length > 1 && (
              <p className="earnings-currency-label">{currency.toUpperCase()}</p>
            )}
            <div className="earnings-summary-grid">
              <article className="earnings-summary-card featured">
                <span>Earned</span>
                <Price cents={earned} currency={currency} decimals />
                <small>Completed replies</small>
              </article>
              <article className="earnings-summary-card">
                <span>Secured</span>
                <Price cents={reserved} currency={currency} decimals />
                <small>Waiting for your reply</small>
              </article>
              <article className="earnings-summary-card">
                <span>Transferred</span>
                <Price cents={transferred} currency={currency} decimals />
                <small>Sent to your payout balance</small>
              </article>
            </div>
          </div>
        );
      })}

      <div className="earnings-main-grid">
        <div className="earnings-activity-card">
          <div className="earnings-section-title">
            <div>
              <p className="eyebrow">ACTIVITY</p>
              <h2>Recent earnings</h2>
            </div>
            {rows.length > 0 && <span>Latest 100</span>}
          </div>

          {rows.length ? (
            <div className="earnings-list">
              {rows.map((row) => (
                <article className="earnings-row" key={row.id}>
                  <span className="earnings-row-icon">
                    <Icon name="message" size={18} />
                  </span>
                  <div className="earnings-row-person">
                    <strong>{row.fanName}</strong>
                    <span>
                      Guaranteed reply · {new Date(row.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <span className={`earnings-status status-${row.payment_state}`}>
                    {statusLabel(row)}
                  </span>
                  <div className="earnings-row-value">
                    <Price
                      cents={row.creator_cents}
                      currency={row.currency}
                      decimals
                    />
                    <span>
                      from <Price cents={row.gross_cents} currency={row.currency} decimals />
                    </span>
                  </div>
                  {row.needs_reconciliation && (
                    <p className="earnings-review-note">
                      Payment status needs review. Your submitted reply is
                      safely saved.
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="earnings-empty">
              <span>
                <Icon name="sparkles" size={25} />
              </span>
              <h3>Your first earning will appear here.</h3>
              <p>
                Once a fan secures a request, you’ll see the amount and its
                status here. You only earn after sending a qualifying reply.
              </p>
              <Link className="button button-secondary" href="/creator/profile">
                Review your offering <Icon name="arrow" size={16} />
              </Link>
            </div>
          )}
        </div>

        <aside className="earnings-guide-card">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>Your 85% stays visible.</h2>
          <div className="earnings-split-example">
            <span>Fan secures</span>
            <Price cents={400} decimals />
            <span>ReplyPass · 15%</span>
            <Price cents={60} decimals />
            <strong>You earn · 85%</strong>
            <Price cents={340} decimals />
          </div>
          <p>
            Secured funds are potential earnings. They become earned after a
            qualifying reply is captured, then move to your Stripe payout
            balance.
          </p>
          <Link href="/creator/payouts">
            View payout status <Icon name="arrow" size={15} />
          </Link>
        </aside>
      </div>
    </section>
  );
}
