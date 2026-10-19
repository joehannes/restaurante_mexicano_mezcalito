# Development and operations

Astro 7 (server output) with React islands and Tailwind 4, on Cloudflare
Workers. The research, concept and plan are in the [README](../README.md).

## First run

```sh
npm install
cp .dev.vars.example .dev.vars   # DEV_STAFF_EMAIL lets you into /admin locally
npm run db:migrate:local         # create the local D1 database
node scripts/build-seed.ts       # seed/data.ts -> seed/seed.sql
npm run db:seed:local            # menu, nights, seasons, settings, radio script
npm run dev                      # http://localhost:4321 (runs in the background)
npx astro dev stop               # stop it
```

Local dev runs D1, KV, R2, the rate limiter and the KitchenRoom Durable
Object on your machine. Workers AI only exists on Cloudflare: set
`CLOUDFLARE_API_TOKEN` to reach it through the remote proxy. Without it
The Selector answers from its rules, translation drafts and voice rendering
report "unavailable", and everything else works.

If the dev server starts answering 500 with "file does not exist in the
optimize deps directory" (after `npm install` or a production build), stop
it, `rm -rf node_modules/.vite`, and start it again.

## Checks

```sh
npm test          # vitest: domain core, validators, payments, seed consistency
npm run check     # astro check + tsc
npm run build
```

CI runs all three on every pull request and push to `main`.

## Layout

| Path | What |
|---|---|
| `src/domain/` | Pure, tested core, no I/O: `pricing`, `schedule` (Bávaro clock, open now, nights, seasons), `capacity` (bookings), `orderStatus`, `roles`, `selector` (scoring, plates, AI-answer checks), `radioTree`, `seasonPresets`, and the input validators (`orderInput`, `reservationInput`, `partyInput`, `adminInput`). |
| `src/server/` | D1 loaders and writes, `KitchenRoom` (Durable Object), `access` + `jwt` (staff sign-in), `payments/` (Azul, PayPal), `notify` (WhatsApp, email), `selector` (Workers AI), `radio` (voices), `insights`, `staffData`. |
| `src/pages/[lang]/` | Guest pages in `en`, `es`, `fr`, `de`: home, menu, checkout, `o/<code>`, reserve, tonight, selector, radio, `season/<slug>`, parties, story, find-us. `/` negotiates the language. |
| `src/pages/admin/` | Staff pages: orders board, menu, nights, bookings, seasons, radio, insights, settings, table QR codes, staff. |
| `src/pages/api/` | Guest endpoints (order, reserve, parties, selector, radio, table, pay) and `api/admin/*`. |
| `src/islands/` | React islands; `islands/admin/` for the staff screens. |
| `src/i18n/` | `ui.ts` + `en/es/fr/de.ts` for guests; `admin.ts` (EN/ES) for staff. Menu, offer and season text lives in D1. |
| `src/middleware.ts` | Staff sign-in for `/admin` and `/api/admin`, the admin write header, the public rate limit. |
| `src/worker.ts` | Worker entry: WebSockets, the edge cache for public pages, visit counting, the Durable Object export, the cron. |
| `migrations/` | D1 schema. |
| `seed/data.ts` | Launch content from Mezcalito's own menu. `UNCONFIRMED` lists what the owner must check. |
| `public/sw.js` | Service worker: pages network-first with an offline copy, the menu saved for offline reading. |

## Money and time

- Money is integer **centavos** everywhere (RD$1 = 100).
- Dates are `YYYY-MM-DD` and times `HH:MM` in **America/Santo_Domingo**;
  `24:00` is the midnight that ends a day, and a close at or before the open
  runs past midnight.

## Caching

Public pages without a query string are cached at the edge for 60 seconds,
keyed by the `content-version` in KV (bumped by every staff save) and the
build id, so an 86, a new price or a new season shows at once and a deploy
never serves old HTML. Order pages, checkout, previews and the API are never
cached. The service worker keeps the last copy of each public page and the
menu for weak signal.

## Configuration

Every secret is optional; each feature switches on when its values are set.
Locally they go in `.dev.vars` (see `.dev.vars.example`); in production use
`wrangler secret put NAME`.

| Feature | Values |
|---|---|
| Staff sign-in | `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `OWNER_EMAILS` |
| Azul (cards) | `AZUL_MERCHANT_ID`, `AZUL_AUTH_KEY`, `AZUL_MERCHANT_NAME`, `AZUL_MODE=live` |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_MODE=live` |
| WhatsApp to guests | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM`, `STAFF_EMAILS` |

### Staff sign-in (Cloudflare Access)

1. Zero Trust → Access → Applications → add a self-hosted application for
   the site's domain with two paths, `/admin` and `/api/admin`, and a policy
   allowing the staff's emails (one-time PIN is enough).
2. Copy the application's audience tag into `ACCESS_AUD` and the team
   domain (`<team>.cloudflareaccess.com`) into `ACCESS_TEAM_DOMAIN`.
3. Put the owner's email in `OWNER_EMAILS`. They add everyone else under
   Admin → Staff as kitchen or manager.

The Worker checks the Access token itself on every staff request; Access
being in front is not trusted on its own.

### Online payments

An order paid online waits as `awaiting_payment` and reaches the kitchen only
when the provider's signed answer confirms it; the cron cancels it after 30
minutes unpaid. The guest can retry or switch to paying in person.

- **Azul Payment Page.** Request and response are signed with HMAC-SHA512
  over the fields in Azul's order (`src/server/payments/azul.ts`). Check that
  order against the integration guide Azul sends with the credentials, and
  run a sandbox payment, before setting `AZUL_MODE=live`. Return URLs are
  `/api/pay/azul/{approved,declined,cancelled}/<code>/<key>`.
- **PayPal** charges in US dollars at the admin's rate, rounded up to the
  cent; the guest sees the dollar amount at checkout.

### WhatsApp templates

Business messages outside a conversation the guest started need templates
approved in Meta Business Manager, each in `en`, `es`, `fr` and `de`, with
these names and body parameters:

| Template | Parameters |
|---|---|
| `mezcalito_order_received` | {{1}} first name, {{2}} order code, {{3}} link to the live order page |
| `mezcalito_order_ready` | {{1}} order code |
| `mezcalito_order_on_the_way` | {{1}} order code |
| `mezcalito_reservation_confirmed` | {{1}} first name, {{2}} date and time, {{3}} party size, {{4}} reservation code |
| `mezcalito_reservation_reminder` | {{1}} first name, {{2}} time, {{3}} reservation code |

Reminders go out about three hours before same-day bookings.

### Workers AI

- The Selector: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` with a JSON
  schema; any answer that fails `checkAiPlate` (or takes over 7 s) is
  replaced by the rules.
- Translation drafts in the admin: `@cf/meta/m2m100-1.2b`.
- Radio voices: `@cf/deepgram/aura-2-en`, `@cf/deepgram/aura-2-es`,
  `@cf/myshell-ai/melotts` (French). German is read by the guest's device.
  Render them from Admin → Radio once the script is final.

## Deploying

`main` deploys from GitHub Actions once the repository has the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets. Before the
first deploy:

1. `wrangler d1 create mezcalito` and put its id in `wrangler.jsonc`.
2. `wrangler kv namespace create CACHE` and `wrangler r2 bucket create mezcalito-media`.
3. Seed once: `wrangler d1 execute mezcalito --remote --file=seed/seed.sql`
   (it replaces the content tables — never run it again after staff start editing).
4. Set the secrets above, then point the domain at the Worker. The old
   site's `.html` pages redirect to their new homes.
