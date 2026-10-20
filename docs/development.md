# Development and operations

Astro 7 (server output) with React islands and Tailwind 4, on Cloudflare
Workers. The research, concept and plan are in the [README](../README.md).

## First run

```sh
npm install
cp .dev.vars.example .dev.vars   # DEV_STAFF_EMAIL lets you into /admin locally (or sign in with the password)
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
| `src/domain/` | Pure, tested core, no I/O: `pricing`, `schedule` (Bávaro clock, open now, nights, seasons), `capacity` (bookings), `orderStatus`, `roles`, `selector` (scoring, plates, AI-answer checks), `radioTree`, `seasonPresets`, `whatsappTemplates`, and the input validators (`orderInput`, `reservationInput`, `partyInput`, `adminInput`). |
| `src/server/` | D1 loaders and writes, `KitchenRoom` (Durable Object), `access` + `jwt` (staff sign-in), `payments/` (Azul, PayPal), `notify` (WhatsApp, email), `selector` (Workers AI), `radio` (voices), `media` (R2 writes inside the free tier), `origin` (the site's address), `insights`, `staffData`. |
| `src/pages/[lang]/` | Guest pages in `en`, `es`, `fr`, `de`: home, menu, checkout, `o/<code>`, reserve, tonight, selector, radio, `season/<slug>`, parties, story, find-us. `/` negotiates the language. |
| `src/pages/admin/` | Staff pages: orders board, menu (dishes, sizes, extras, sections), nights, events, polaroid wall, bookings, seasons, radio, insights, settings (incl. payments), table QR codes, WhatsApp templates, staff (incl. the admin password); `login` and `logout`. |
| `src/pages/api/` | Guest endpoints (order, reserve, parties, selector, radio, table, pay) and `api/admin/*`. |
| `src/islands/` | React islands; `islands/admin/` for the staff screens. |
| `src/i18n/` | `ui.ts` + `en/es/fr/de.ts` for guests; `admin.ts` (EN/ES) for staff. Menu, offer and season text lives in D1. |
| `src/middleware.ts` | Staff sign-in for `/admin` and `/api/admin`, the admin write header, the public rate limit. |
| `src/worker.ts` | Worker entry: WebSockets, the edge cache for public pages, visit counting, the Durable Object export, the cron. |
| `migrations/` | D1 schema. |
| `seed/data.ts` | Launch content from Mezcalito's own site, menu and deals page. `DECIDED` notes which source won where they disagreed; `UNKNOWN` is what none of them says. |
| `public/sw.js` | Service worker: pages network-first with an offline copy, the menu saved for offline reading. |
| `public/img`, `public/video` | Mezcalito's own logo, photos and promo video from their website, sized for the web; icons and the share image are made from the logo. `img/polaroids` and `video/polaroid-*` are stills and loops cut from the promo for the polaroid wall. |
| `public/img/art`, `public/img/stickers` | Illustrations and die-cut stickers drawn with Workers AI by the "Generate art" workflow (`scripts/art/prompts.json`), curated by hand. |

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
| Staff sign-in by email | `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `OWNER_EMAILS` (the admin password works without them) |
| Azul (cards) | `AZUL_MERCHANT_ID`, `AZUL_AUTH_KEY`, `AZUL_MERCHANT_NAME`, `AZUL_MODE=live`, or typed in Admin → Settings |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_MODE=live`, or typed in Admin → Settings |
| WhatsApp to guests | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM`, `STAFF_EMAILS` |

### Staff sign-in: the admin password

`/admin` asks for a password: **`admin`** until an owner changes it under
**Admin → Staff → Admin password** (an orange bar nags until then). It signs
in as an owner for 30 days; changing it ends every other session; ten wrong
tries from one address lock that address out for 15 minutes. The password's
hash, the cookie key and payment credentials typed in the admin live in the
`private_settings` table, which no guest page reads (`settings` is read
whole into every page, so nothing secret may go there).

### Staff sign-in by email (Cloudflare Access, optional)

1. Zero Trust → Access → Applications → add a self-hosted application for
   the site's domain with two paths, `/admin` and `/api/admin`, and a policy
   allowing the staff's emails (one-time PIN is enough).
2. Copy the application's audience tag into `ACCESS_AUD` and the team
   domain (`<team>.cloudflareaccess.com`) into `ACCESS_TEAM_DOMAIN`.
3. Put the owner's email in `OWNER_EMAILS`. They add everyone else under
   Admin → Staff as kitchen or manager.

The Worker checks the Access token itself on every staff request; Access
being in front is not trusted on its own.

### What staff run from the admin

- **Menu**: dishes (add, edit, delete, order), their sizes with prices, which
  extras groups each dish offers, the shared extras groups and their
  options and prices, and the menu's sections (add, rename, hide, order,
  delete when empty). The kitchen still only sees the sold-out switches.
- **Events**: one-off marketing events with their own page at
  `/<lang>/event/<slug>`. The one on today (else the next within three
  weeks) is featured on the home page as a ticket and at `/<lang>/event`.
  Drafts are visible only to signed-in staff.
- **Polaroid wall**: photos and short silent mp4 clips (up to 25 MB) with a
  caption, tilt and order; ticked ones (the first ten) also hang on the
  home page, all of them on `/<lang>/gallery`.
- **Settings → Payments**: which ways to pay guests see at checkout (cash,
  card on delivery, Azul, PayPal), a note shown at checkout, and (owners
  only) the Azul and PayPal credentials. Secrets set on the Worker win over
  ones typed here; secrets are never shown again once saved. Credentials
  cannot be saved while the admin password is still the default.

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
approved in Meta Business Manager, each in `en`, `es`, `fr` and `de`. Their
full texts live in `src/domain/whatsappTemplates.ts`, and **Admin →
WhatsApp** shows them ready to copy, with the steps, links and the email
to register with. Staff tick each language there as Meta approves it; only
ticked languages are sent (a guest whose language is not approved gets
English, then Spanish). Names and body parameters:

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
- Illustrations: the manual **Generate art** workflow draws everything in
  `scripts/art/prompts.json` with FLUX.2 and uploads it as a workflow
  artifact. The deploy token needs **Workers AI: Read** (and Edit) for it.
  Picks are converted to WebP into `public/img/art` (1200 px and 640 px)
  and `public/img/stickers` (white background cut away, 256 px).

## Deploying

`main` deploys from GitHub Actions once the repository has the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets. The workflow
applies new migrations, then deploys.

The account's resources exist and their ids are in `wrangler.jsonc`:
D1 `mezcalito` (all migrations applied and seeded on 19 Oct 2026), KV
`mezcalito-cache` and R2 `mezcalito-media`. **Never run `seed/seed.sql`
against it again**: it replaces the content tables staff now edit.

The site runs as the Worker `mezcalito-rd` at
https://mezcalito-rd.johannes-neugschwentner.workers.dev (first deployed
20 Oct 2026). Links in messages, the sitemap
and search data use whatever address it is served on (remembered in KV for
the reminder cron); set `SITE_URL` in `wrangler.jsonc` once a domain points
here. The old site's `.html` pages redirect to their new homes.

Secrets (the table above) are set with `wrangler secret put`, or in the
Cloudflare dashboard under Workers → mezcalito-rd → Settings → Variables and
secrets.

The Worker is not called plain `mezcalito`: a first deploy that failed
halfway left that name half-created on Cloudflare, and every upload to it
answered "This Worker does not exist" (10007). The deploy token's Workers
role needs **Admin** (all Workers) to create a Worker; **Editor** is
enough to update one that exists.

### Staying on the free plan

Keep the account on **Workers Free**. There, Workers requests, D1, KV,
Durable Objects and Workers AI stop with an error at their daily limits
instead of billing. R2 is the exception: it has no spending cap and bills
past 10 GB stored or a million writes a month. So every R2 write goes
through `src/server/media.ts`, which refuses once the bucket would pass
9 GB or 25,000 writes in a day (counted in the `media_usage` table). Staff
then see "Media storage is at its free limit". R2 reads stay free, because
Workers Free's 100,000 requests a day are fewer than R2's ten million free
reads a month.

As a backstop, add a budget alert under Billing → Billable usage
(for example at US$1). It emails you if anything ever starts to cost
money.
