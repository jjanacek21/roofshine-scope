# Seats & billing tab for company owners/admins

A new tab in the Claim Buddy company admin portal (next to Branding, Team, Pricing) where an owner or admin can see exactly what they're paying for, how many seats are in use, what an extra seat costs on their plan, and buy more seats with a card through Stripe checkout.

## What the page shows

- **Plan card** — current plan (Basic / Pro / Elite), what's included, trial status and next billing date.
- **Seat usage** — seats purchased, seats in use, invites pending, seats remaining, with a simple usage bar.
- **Cost breakdown** — base fee, included seats, extra seats × extra-seat rate, current monthly total. Uses the pricing already defined in the app: Basic $19.99/user/mo (no bundled seats), Pro $120/mo with 3 seats then $30/seat, Elite $200/mo with 3 seats then $40/seat.
- **Buy seats** — a stepper to add N seats, a live "your new monthly total" preview, and a "Continue to checkout" button that opens Stripe.
- **Billing history / manage** — link into the Stripe billing portal so the owner can change the card or cancel.

Only owners can purchase; admins see the same numbers read-only. Reps never reach the tab (the existing admin gate handles it).

## Purchase flow

1. Owner picks how many seats to add and confirms the preview.
2. The app creates a Stripe Checkout session in subscription mode for that seat quantity at the plan's extra-seat rate.
3. Stripe redirects back to the seats tab with a success state.
4. The Stripe webhook confirms payment and raises the workspace's purchased seat count — seats are only granted after Stripe confirms, never optimistically.
5. The Team tab immediately reflects the new seat count, so invites that were blocked by "no seats left" now go through.

If checkout is abandoned, nothing changes.

## Technical notes

- Route: `src/routes/cb.admin.seats.tsx`, registered as a 4th tab in `src/components/cb/CbAdminShell.tsx`, with its own `head()` metadata.
- Reuses `src/lib/cbPricing.ts` for all math (`quoteSeats`, `extraSeatCost`, `seatRateLabel`) so the portal, the marketing pricing page and signup never disagree. No pricing numbers are duplicated in the new page.
- Seat/usage read: existing `cb_seats(_ws)` RPC plus `cb_workspaces` (`plan`, `seats_purchased`, `billing_status`, `trial_ends_at`).
- New server functions in `src/lib/cb-billing.functions.ts`:
  - `cbCreateSeatCheckout` — owner-only (verified server-side via `cb_is_owner`), builds a Stripe subscription Checkout session using the existing gateway Stripe client in `src/lib/stripe.server.ts` (same connection already used for invoice payments), with inline `price_data` at the plan's seat rate and `metadata: { workspace_id, plan, seats }`.
  - `cbBillingPortal` — returns a Stripe billing portal URL for the workspace's customer.
- New table `cb_seat_purchases` (workspace_id, seats, unit_amount, stripe_session_id, stripe_subscription_id, status, created_by, timestamps) with GRANTs, RLS restricted to workspace admins for select and service_role for writes; plus `stripe_customer_id` / `stripe_subscription_id` columns on `cb_workspaces`.
- Webhook: extend `src/routes/api/public/payments/webhook.ts` to handle `checkout.session.completed`, `customer.subscription.updated` and `deleted` when `metadata.workspace_id` is present — increment/set `seats_purchased`, record the purchase row, and write a `cb_audit_log` entry. Existing invoice handling is untouched and keyed off `invoice_id` metadata as today.
- Seat downgrades and refunds are out of scope for this pass; the portal link covers cancellation.
