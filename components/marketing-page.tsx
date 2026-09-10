import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import {
  PLATFORM_FEE_PERCENT,
  CREATOR_SHARE_PERCENT,
  splitPayment,
} from "@/lib/payments/fees";
import { Price } from "./ui";
export function MarketingPage({
  forCreators = false,
}: {
  forCreators?: boolean;
}) {
  const split = splitPayment(400);
  return (
    <main id="main" className="marketing">
      <section className="marketing-hero">
        <div className="marketing-copy">
          <p className="eyebrow">
            {forCreators
              ? "YOUR PEOPLE. YOUR PACE."
              : "FOLLOWING IS JUST THE BEGINNING"}
          </p>
          <h1>
            {forCreators ? (
              <>
                Get paid for
                <br />
                your attention<span>.</span>
              </>
            ) : (
              <>
                A little closer to
                <br />
                the people
                <br />
                you follow<span>.</span>
              </>
            )}
          </h1>
          <p className="marketing-lead">
            {forCreators
              ? "Your followers already want to hear from you. Give them a better way to reach you—and give yourself control over your time."
              : "A thoughtful question. A personal reply. A conversation that goes beyond the comments. ReplyPass gives creators and their communities a more direct way to connect."}
          </p>
          <div className="marketing-actions">
            <Link
              className="button button-primary"
              href={forCreators ? "/creator/apply" : "/creators"}
            >
              {forCreators ? "Become a creator" : "I’m a creator"}{" "}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link href={forCreators ? "#creator-how" : "#how-it-works"}>
              See how it works ↓
            </Link>
          </div>
          <p className="marketing-note">
            {forCreators
              ? "Build your page first. Connect payouts before accepting paid replies."
              : "Here for someone? Start with the ReplyPass link in their bio."}
          </p>
        </div>
        <div className="marketing-showcase">
          <div className="showcase-photo">
            <Image
              src="/images/stella.jpg"
              alt="Stella May, a fictional creator used to demonstrate ReplyPass"
              fill
              sizes="(max-width: 760px) 90vw, 460px"
              priority
            />
            <span className="showcase-label">FICTIONAL CREATOR · DEMO</span>
            <div className="showcase-name">
              Stella May<span>@stella</span>
            </div>
          </div>
          <div className="showcase-message">
            <span className="eyebrow">A QUESTION WORTH ASKING</span>
            <p>“What helped you find your own creative style?”</p>
            <div>
              <span>Guaranteed reply</span>
              <strong>No reply = no charge.</strong>
            </div>
          </div>
          <Link className="showcase-link" href="/@stella">
            Explore Stella’s demo page <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
      <section className="marketing-strip" aria-label="Who ReplyPass is for">
        <p>
          Different talents.
          <br />
          <strong>The same human connection.</strong>
        </p>
        <div>
          Creators · Athletes · Musicians · Models · Experts · Your next
          inspiration
        </div>
      </section>
      <section id="how-it-works" className="marketing-section">
        <div className="marketing-section-heading">
          <p className="eyebrow">FOR THE PEOPLE WHO FOLLOW</p>
          <h2>
            Your creator.
            <br />
            Your conversation.
          </h2>
          <p>
            No directory to navigate. No account to create before you’ve found
            someone. Start with the person you already follow.
          </p>
        </div>
        <div className="marketing-steps">
          {[
            [
              "01",
              "Follow their link",
              "Open a creator’s ReplyPass page from their bio, story or a link they share.",
            ],
            [
              "02",
              "Make it personal",
              "Choose an available interaction and write your message. Sign up or log in when you’re ready to continue.",
            ],
            [
              "03",
              "Stay connected",
              "Return to the same creator and request. Follow its progress and your conversations in your account.",
            ],
          ].map(([n, title, body]) => (
            <article key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="marketing-promise">
        <div>
          <p className="eyebrow">THE GUARANTEED REPLY PROMISE</p>
          <h2>
            No reply.
            <br />
            No charge<span>.</span>
          </h2>
        </div>
        <div>
          <p>
            For a Guaranteed Reply, the price is reserved on your card first.
            Accepting your request doesn’t charge you. A qualifying creator
            reply within the deadline does.
          </p>
          <p>
            If the creator declines or doesn’t reply in time, the reservation is
            canceled. Your bank may take time to remove the hold.
          </p>
          <span className="marketing-status">
            Currently in test mode · No live payments
          </span>
        </div>
      </section>
      <section className="marketing-section">
        <div className="marketing-section-heading">
          <p className="eyebrow">MORE WAYS TO SAY HELLO</p>
          <h2>
            A connection that
            <br />
            fits the moment.
          </h2>
          <p>
            Creators choose what they offer. Guaranteed Reply is being tested
            first; the other formats below are previews, with paid access coming
            later.
          </p>
        </div>
        <div className="marketing-offers">
          {[
            [
              "↗",
              "Guaranteed reply",
              "A question with room for a personal answer.",
              "TEST MODE",
            ],
            [
              "◷",
              "Live text chat",
              "Time set aside for a real conversation.",
              "COMING LATER",
            ],
            [
              "♫",
              "Voice notes",
              "A personal answer in their own voice.",
              "COMING LATER",
            ],
            [
              "▧",
              "Photo & video requests",
              "A personalized moment from your creator.",
              "COMING LATER",
            ],
            [
              "♡",
              "VIP subscriptions",
              "Basic messaging and private posts.",
              "COMING LATER",
            ],
          ].map(([icon, title, body, status]) => (
            <article key={title}>
              <span className="marketing-offer-icon" aria-hidden="true">
                {icon}
              </span>
              <small>{status}</small>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="creator-how" className="marketing-creator">
        <div>
          <p className="eyebrow">FOR THE PEOPLE WHO CREATE</p>
          <h2>
            Turn your attention
            <br />
            into income.
          </h2>
          <p>
            Your audience already knows you. Bring them to a page that feels
            like yours, set your boundaries, and make space for the
            conversations you want.
          </p>
          <Link className="button button-primary" href="/creator/apply">
            Build my creator page ↗
          </Link>
        </div>
        <ol>
          <li>
            <strong>Make it yours</strong>
            <p>
              Choose your username, add your photo and bio, and preview your
              public page.
            </p>
          </li>
          <li>
            <strong>Set your terms</strong>
            <p>
              Choose your prices and availability. Connect an eligible Stripe
              payout account before enabling Guaranteed Reply.
            </p>
          </li>
          <li>
            <strong>Share your link</strong>
            <p>
              Add getreplypass.com/@yourname to your bio. Fans arrive on your
              page and stay connected to you.
            </p>
          </li>
          <li>
            <strong>Reply, then earn</strong>
            <p>
              Accept a secured request, send your reply before the deadline, and
              track your earnings.
            </p>
          </li>
        </ol>
      </section>
      <section className="marketing-fees">
        <div>
          <p className="eyebrow">CLEAR FROM THE START</p>
          <h2>
            You set the price.
            <br />
            You keep {CREATOR_SHARE_PERCENT}%.
          </h2>
          <p>
            ReplyPass’s platform share is {PLATFORM_FEE_PERCENT}%. The split is
            shown before you reply. The platform share is before Stripe
            processing costs; transferred earnings are distinct from bank
            payouts.
          </p>
        </div>
        <div className="marketing-receipt">
          <p>AN EXAMPLE GUARANTEED REPLY</p>
          <dl>
            <div>
              <dt>Fan price</dt>
              <dd>
                <Price cents={split.fanCents} decimals />
              </dd>
            </div>
            <div>
              <dt>ReplyPass · {PLATFORM_FEE_PERCENT}%</dt>
              <dd>
                <Price cents={split.platformCents} decimals />
              </dd>
            </div>
            <div>
              <dt>Creator share · {CREATOR_SHARE_PERCENT}%</dt>
              <dd>
                <Price cents={split.creatorCents} decimals />
              </dd>
            </div>
          </dl>
          <small>Illustration only. Live payments are not enabled.</small>
        </div>
      </section>
      <section className="marketing-faq">
        <div>
          <p className="eyebrow">A FEW THINGS TO KNOW</p>
          <h2>
            Good questions.
            <br />
            Straight answers.
          </h2>
        </div>
        <div>
          {[
            [
              "Can I sign up as a fan here?",
              "Fan signup starts on a creator’s page. Find their ReplyPass link in their bio or content, choose how you’d like to connect, and create an account there. If you already have an account, use Log in.",
            ],
            [
              "Do I need an account for every creator?",
              "No. One fan account keeps your conversations and requests together across creators. Each creator’s link still takes you directly to their own page.",
            ],
            [
              "What happens when I tap the logo on a creator’s page?",
              "You stay with that creator and return to the top of their profile. Use About ReplyPass in the footer whenever you want to visit this homepage.",
            ],
            [
              "Does accepting a request mean I’ve been charged?",
              "No. For Guaranteed Reply, acceptance leaves the funds reserved. Capture follows the first qualifying creator reply before the deadline. A decline or unanswered deadline cancels the reservation.",
            ],
            [
              "Can creators launch before connecting payouts?",
              "Yes. Create and publish your profile first. Guaranteed Reply stays disabled until Stripe payout eligibility is verified, then you can enable it in your profile settings.",
            ],
            [
              "Are payments available now?",
              "ReplyPass is currently being tested. Guaranteed Reply supports Stripe test mode when configured. Live chat, media requests and VIP subscriptions remain demo previews; no live payments are enabled.",
            ],
            [
              "What kind of community is ReplyPass?",
              "ReplyPass is designed for respectful, brand-safe interactions across sport, music, fashion, business and everyday creativity. It isn’t an adult-content platform. Read our draft community guidelines for the current policy direction.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="marketing-end">
        <p className="eyebrow">LESS DISTANCE. MORE CONVERSATION.</p>
        <h2>
          {forCreators
            ? "Your people are waiting."
            : "Let’s make following feel closer."}
        </h2>
        <Link
          className="button button-primary"
          href={forCreators ? "/creator/apply" : "/creators"}
        >
          Become a creator ↗
        </Link>
        <p>
          Already part of {siteConfig.name}? <Link href="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}
