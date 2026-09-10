# ReplyPass measurement plan

GA4 measurement ID: `G-C6DL1WLHDM`. Only `getreplypass.com` sends analytics. Localhost and preview hosts never do. Analytics is release-gated: set `NEXT_PUBLIC_GA_ENABLED=true` in Vercel and redeploy only after completing the stream settings below. It is disabled by default. Do not install the supplied snippet separately: it would duplicate tracking and bypass consent.

## Consent

Basic Consent Mode v2: the Google script is absent until analytics is accepted. Reject and accept are equally accessible; the footer opens preferences again. Choice expires after 180 days. Advertising storage, advertising user data and personalization are always denied. Withdrawal disables GA, removes accessible GA cookies and reloads; another tab changing the choice also reloads this tab. Without localStorage, analytics remains disabled. Essential authentication storage is unaffected. This is a small first-party consent interface, not a claim of legal certification. Review the draft privacy policy before commercial launch. A managed CMP can replace this interface later; do not run two banners or Google tags.

## Page map

| Route | GA page group |
|---|---|
| `/` | home |
| `/creators` | creator_landing |
| `/@username` | creator_profile |
| `/login`, `/signup` | login, signup |
| `/creator/apply` | creator_onboarding |
| `/creator/dashboard`, `/creator/inbox`, `/creator/requests` | creator_dashboard, creator_inbox, creator_requests |
| `/creator/inbox/[id]` | creator_conversation |
| Other creator workspace sections | creator_section (e.g. creator_earnings) |
| `/account`, `/account/requests` | fan_account, fan_requests |
| Trust pages | terms, privacy, community_guidelines, creator_terms |
| Unrecognized paths and callbacks | other |

Page views fire once on route change or consent acceptance; queries, hashes, actual titles, usernames and referrers are excluded. This deliberately trades creator-specific reporting and campaign attribution for a small, safe initial setup. UTM/ad attribution is not implemented yet; plan approved campaign parameters before launching ads.

## Implemented events

| Event | Trigger | Detail |
|---|---|---|
| `creator_cta_click` | Link to recruitment or application | page_group |
| `interaction_select` | Choose an offering | funnel_detail = offering kind; includes demo exploration |
| `signup_submitted` | Supabase accepts signup request | fan/creator; NOT verified signup (Supabase can conceal existing users) |
| `login` | Successful password login | fan/creator journey |
| `creator_onboarding_start` | Start real onboarding | none |
| `creator_onboarding_step` | Validated next step | step number |
| `creator_launch_success` | Server accepts real creator launch | none; excludes profile editing |
| `checkout_started` | Server returns secured reply quote | message; test-mode checkout, not revenue |

Events are consent-gated and do not replay pre-consent actions. No arbitrary text, errors, form values, IDs or money are sent. No `purchase` event is emitted. Payment authorization is not purchase. Future payment conversions need webhook-confirmed capture, idempotent reporting, consent handling and a separate test/live distinction. Future milestones: verified signup, Connect ready, request authorized, creator reply delivered, payment captured and refund. These are planned, not implemented analytics events.

## GA4 setup required

1. Admin → Data streams → select this web stream. **Turn off Enhanced measurement** (including automatic history page views, form interactions, outbound clicks and site search). ReplyPass emits its own sanitized events; automatic measurement can collect unsanitized URLs. Do this before deploying.
2. Keep Google Signals and user-provided data collection disabled. Do not add another Google tag through GTM or Vercel.
3. Admin → Custom definitions: create event-scoped dimensions `page_group` and `funnel_detail`.
4. After events arrive, mark `creator_launch_success` as a key event. Do not mark `signup_submitted` as verified signup or checkout as purchase.
5. Explore → Funnel exploration: home/creator_landing → creator_cta_click → signup_submitted (creator) → creator_onboarding_start → creator_launch_success. Fan funnel: creator_profile → interaction_select → signup_submitted/login → checkout_started. Consent refusals, cross-browser email confirmation and blocked analytics naturally make these incomplete.
6. Verify production in Realtime after accepting. Use Google Tag Assistant to inspect all four consent signals. No GA requests should occur in a fresh browser before consent or after rejection.

No GA4 account settings were changed by this code deployment. Reports depend on consent, blockers and GA processing; financial reporting remains in the database/Stripe.
