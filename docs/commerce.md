# Accounts, purchased gems, and VIP — test implementation

This implementation adds a separate account store to the browser game. It does
not charge real money. The service refuses live Stripe keys and live webhook
events. Sample prices are not launch pricing.

The test store explicitly requests standard Checkout with
`managed_payments[enabled]=false`. Some new Stripe sandboxes default to Managed
Payments, which rejects an explicit card payment method and can add tax to the
fixed sample totals. This setting applies to each test checkout; it does not
change the Stripe account's dashboard defaults.

## GitHub Pages publication

The game and storefront preview are published at
<https://mmoritz2.github.io/meadowlark-ranch/store.html>. GitHub Pages serves
static files; it cannot run this Node.js account server, its database, or Stripe
webhooks. On `github.io`, the store displays all 127 tack pieces in 32 collections with
illustrated previews, collection filters and exact-item 3D fitting-room links.
The free Classic Western set and earned-coin tack can be equipped from the
in-game boutique. The six premium sets, gems and VIP show a sample catalog.
The store disables
purchases, and hides sign-in and cloud-backup controls. It never sends account
or payment API requests. The game continues to use its existing local saves.

To offer working accounts and purchases online, deploy the game and account
server together on a persistent HTTPS host. Configure private server credentials
and a Stripe webhook there. Never publish a local computer address, a secret
key, or a public tunnel as the payment backend. The current implementation
continues to reject real payments until the launch work below is completed.

## Run locally

Use Node.js 22.13 or later. There is no npm install or frontend build step.

```sh
node server/commerce.mjs
```

Open <http://127.0.0.1:8432/store.html>. The same server serves the game at
<http://127.0.0.1:8432/ranch3d.html>. In the game, use Menu → More → Account & VIP, or Market → Currencies →
Gems & VIP. The store includes a discovery page, tack catalog, Gems, VIP passes and Your
account tabs. The account tab is available only on the account server.
Cloud backup and purchase history are under Your account.

Accounts, recovery, and cloud-backup controls work without Stripe. Checkout is
disabled until a test payment connection and webhook listener are configured.
The local development server
keeps backups on this computer; other devices can use them after the service is
hosted on an HTTPS domain.

The SQLite database defaults to
`~/.local/share/meadowlark-ranch/commerce.sqlite`, outside the public checkout.
Override with `COMMERCE_DB` pointing to another private, persistent location.
Do not place databases or secret environment files inside a folder exposed by
Python's static server or another unrestricted file server. The commerce server
only serves an explicit list of public pages and assets, never database files,
server code, dotfiles, or test output.

Browser saves belong to an origin. A ranch saved at port 8431 or GitHub Pages will
not automatically appear at port 8432 or a new production domain. Export the
existing ranch from Settings → Account at its old address, then import it in the
game at the new address before creating a cloud backup. Imported ranches never
credit purchased gems or account VIP.

## Connect Stripe test mode

For local testing, the [CLI launcher](#local-cli-launcher) uses the approved
Stripe CLI login without copying a server API key. The server-key method below
also supports hosted testing.

### Server-key setup

1. Create or select a Stripe sandbox/test account.
2. Copy the names in `server/.env.example` into a private environment file outside
   the public checkout. Set `STRIPE_SECRET_KEY` to a server test key: `sk_test_`
   (secret), `rk_test_` (restricted), or `rkcs_test_` (temporary CLI sandbox).
   Each prefix must be followed by the actual nonempty key value. Live keys and
   publishable `pk_test_` keys are rejected. Keep server keys out of browser
   JavaScript, Git, chat, and screenshots.
3. Forward Stripe test events to the local endpoint. With an authenticated
   Stripe CLI:

   ```sh
   stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,charge.refunded,charge.dispute.created,charge.dispute.closed --forward-to http://127.0.0.1:8432/api/stripe/webhook
   ```

4. Set `STRIPE_WEBHOOK_SECRET` to the signing secret from that listener, then run:

   ```sh
   node --env-file=/absolute/private/path/commerce.env server/commerce.mjs
   ```

5. Create an account, save its one-time recovery code, and select a gem pack.
   Complete the hosted checkout with Stripe's test card `4242 4242 4242 4242`, a
   future expiry, and any valid-format test CVC. Never enter a real card into this
   test store. The return page confirms the payment with Stripe and refreshes the
   balance. The webhook also delivers it if the customer closes the page.
6. Redeem purchased gems for VIP, reopen the game, and verify the benefits. Refund
   the test payment from Stripe and verify the corresponding balance adjustment.

Restricted test keys are supported without changing the test-only payment checks.
Use a key scoped to the API operations this service needs and verify it with a
sandbox checkout. See [Stripe restricted API keys](https://docs.stripe.com/keys/restricted-api-keys).
Temporary CLI sandboxes expire after seven days unless claimed; their server key
uses `rkcs_test_`. See [Stripe CLI sandboxes](https://docs.stripe.com/cli/sandbox).

For hosted testing, register the same event types at
`https://YOUR-DOMAIN/api/stripe/webhook` and use that endpoint's test signing
secret. The CLI listener secret and hosted endpoint secret are different.
Set `APP_ORIGIN` to the exact HTTPS origin, without a trailing slash. The server
builds checkout return URLs from this trusted configuration, never from request
input. A reverse proxy must preserve the public Host header.

Reference: [Stripe Checkout creation](https://docs.stripe.com/api/checkout/sessions/create),
[fulfillment and retries](https://docs.stripe.com/checkout/fulfillment), and
[webhook signatures](https://docs.stripe.com/webhooks/signature).

### Local CLI launcher

The launcher uses the approved Stripe CLI login for local test Checkout requests.
It starts the event listener and local server together, passing the listener's
signing secret directly to the server without printing it. No server API key or
manual webhook secret entry is needed. First sign in to the named CLI profile:

```sh
stripe login --project-name meadowlark-test
```

Choose the approved test sandbox. Read its non-secret `account_id` with
`stripe whoami --project-name meadowlark-test --format json`. Edit the private
file `~/.config/meadowlark-ranch/stripe-test.env` locally with the following
settings, replacing the account placeholder with that ID:

```dotenv
PORT=57875
BIND_HOST=127.0.0.1
APP_ORIGIN=http://127.0.0.1:57875
STRIPE_CLI_PROJECT=meadowlark-test
STRIPE_CLI_ACCOUNT=acct_REPLACEWITHYOURACCOUNTID
```

Keep that file outside the game folder with owner-only permissions:

```sh
chmod 600 ~/.config/meadowlark-ranch/stripe-test.env
node tools/start-stripe-test.mjs
```

Stop any existing preview using port 57875 first. Open
<http://127.0.0.1:57875/store.html> and complete the test purchase/refund checks
above. Keep the launcher running while testing; Ctrl+C stops both processes.
Before every API request, the adapter checks that the CLI still uses the
configured account in test mode. It accepts only Checkout creation and retrieval
of test sessions. Switching the CLI account or mode stops checkout until the
configured test profile is restored. This method is restricted to a local
loopback address; hosted deployments must use the server-key setup.

## What is implemented

- Username/password accounts, expiring HttpOnly sessions, sign-out, and recovery
  codes. Recovery rotates the code and revokes all old sessions. Passwords use
  salted scrypt with N=131072, r=8, p=1; session tokens and recovery codes are stored
  as hashes. There is no email collection or email password reset in this version.
- Server-owned product catalog and order snapshots. Clients submit product IDs,
  not prices, quantities, or gem amounts. Credentials and the database remain on
  the server. Stripe hosts all card entry.
- Append-only gem credits/debits, atomic VIP redemption, and idempotent checkout
  and fulfillment. A repeated webhook or return-page request cannot pay twice.
  Webhooks verify the raw request signature and timestamp.
- One-time 30-day VIP checkout plus purchased-gem redemption for 7, 30, or 90 days.
  No subscription is created. There is no automatic renewal.
- Full/partial refunds, duplicate and out-of-order refund events, and dispute
  holds. Refunded gems already spent can produce a negative balance; account
  purchases and paid VIP are held for support review. Paid VIP grants are reduced
  proportionally on refunds. Won disputes release their hold; lost disputes keep
  it. This first version has no operator dashboard for manual adjustments.
- Manual cloud backups with revision checking to prevent overwriting a newer
  save. Restoring requires confirmation, keeps a local undo backup, and does not
  touch the paid wallet. Close other running ranch tabs before restoring, as an
  older tab can overwrite the shared browser save. Backups are not automatic.
- Mobile/desktop storefront, purchase history, and in-game navigation. The game
  checks paid VIP at boot and every minute. Account responses bypass the service
  worker and have `Cache-Control: no-store`.

Password work factors follow the
[OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Deliberate boundary around the existing game

The existing game economy and its earned VIP remain local and editable. This
work does not convert the entire simulation to a server-authoritative game or
make multiplayer/leaderboards cheat-proof.

Purchased gems are a **separate balance**. They currently buy only account VIP
passes, not horses, breeding boosts, keys, cosmetics, or random rewards. None of
the local gem-granting, import, daily-gift, or gift-code paths can write to that
balance. The visible store explains this before checkout.

Paid VIP is fetched from the service, held only in memory, and never copied into
`save.vip`. A successful account verification is usable for at most two minutes;
failed refreshes remove paid access. Earned VIP still works offline. Paid passes
stack with other paid passes and run alongside locally earned VIP; these two
durations are not added together. Local game clients can still modify their own
simulation, but cannot change the account ledger or create a paid entitlement on
the server.

Before letting purchased gems buy more game items, implement server-owned item
ownership and purchase/spending endpoints for each item type. Do not simply add
purchased gems to `localStorage`, or trust an uploaded save as a paid balance.

## Tests

```sh
node --test server/commerce.test.mjs server/stripe-cli.test.mjs
```

The server tests exercise authentication, recovery, expired sessions, rate
limits, account isolation, fake prices, duplicate payment delivery, bad
signatures, delayed payments, mismatched orders, VIP, refunds, disputes, forged
saves, save conflicts, persistence, CSRF protection, and private-file access.
The CLI adapter tests use an injected command runner and cover account/mode
checks, permitted endpoints, literal argument handling, idempotency, sanitized
subprocess environments, response validation, and private error handling.

The browser test uses the project's existing Playwright installation:

```sh
NODE_PATH=/path/to/global/node_modules node tools/qa-commerce.cjs
```

It creates an isolated browser and in-memory account database; simulates Stripe
HTTP responses without sending payment requests; verifies signup, backup,
restore/undo, checkout return, gem redemption, paid VIP inside the game, store
navigation, logout, and mobile overflow. Screenshots are written to
`output/commerce/`. It never reads or modifies the user's browser profile.

These tests do not replace a real Stripe sandbox purchase with your own account
and registered webhook endpoint.

## Remaining before selling to customers

This implementation remains test-only. For an account holder under 18, Stripe
requires a legal guardian to become the account owner before accepting real
payments or receiving payouts. Country-specific age rules also apply; see
[Stripe’s age requirements](https://support.stripe.com/questions/can-i-use-stripe-if-i-am-under-18).

The live-key guard must stay in place until launch work is completed:

- Choose final products, gem quantities, prices, and whether VIP should renew.
  Rebalance prices against the generous earned economy and the existing VIP
  rewards. The current catalog is intentionally provisional.
- Finish the seller's Stripe verification and payout setup; run the real Stripe
  sandbox purchase/refund checks above with the configured account.
- Host this service and game on an HTTPS origin with a persistent private disk,
  access-controlled database backups, monitoring, and a restore procedure. This
  SQLite implementation targets one server; do not run it on ephemeral serverless
  filesystems or copy the live database across instances. Stop the service before
  a filesystem backup, or use SQLite's online backup API. Keep secrets outside
  the public checkout. Configure proxy-level rate limiting as well; the current
  service intentionally does not trust client-supplied forwarded IP headers.
- Add the actual support contact, purchase/refund terms, privacy information,
  applicable tax configuration, and an operator process for account recovery,
  refunds, disputes, and deletion/retention requests.
- Review launch behavior for the intended audience, including parental purchase
  controls if the game is aimed at children. Paid random rewards are not enabled.
- Review the account service for production traffic and security, then add live
  mode as an explicit tested deployment setting. Separate live and test databases
  and Stripe secrets. Never convert the test balances into real purchases.

GitHub Pages cannot run this backend and restricts ecommerce use; use a host
appropriate for the paid service. See
[GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
