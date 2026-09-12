# Pricing and VIP policy

## Interaction prices

Creator prices are stored as integer minor units with a separate currency. Checkout always looks up the active server-side price. The browser never supplies the amount that Stripe should charge.

- A request snapshots its gross price, platform fee, creator share, currency, and fee basis points when it is prepared.
- Existing pending or authorized requests keep that snapshot if the creator edits a price later.
- New requests use the creator's latest active price.
- Disabling an offering blocks new checkout attempts. Existing requests and transaction history remain intact.

## VIP membership contract

VIP is planned as a recurring creator membership. Its initial benefits are basic direct messaging, creator-only posts, a VIP indicator, and creator-controlled member access. Bespoke guaranteed replies, live chat, voice, photo, and video requests remain separately priced unless a future plan explicitly includes them.

Each Stripe recurring Price is immutable. Changing a creator's displayed VIP price creates a new Price version:

- New members subscribe at the latest active price.
- Existing members stay at the price they accepted by default.
- Disabling VIP prevents new subscriptions while existing subscriptions continue until they cancel or the creator ends the program.
- A creator may schedule a future migration only through a separate, explicit flow that shows the effective date and gives members advance notice. Webhooks remain the subscription source of truth.

The `subscriptions.amount_cents` and `currency` columns preserve each member's agreed price. Task work for recurring billing should add immutable Stripe Product/Price references and webhook-managed periods without rewriting historical amounts.
