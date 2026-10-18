# Development

Astro 7 (server output) with React islands and Tailwind 4, on Cloudflare
Workers. The plan, research and decisions are in the [README](../README.md).

## First run

```sh
npm install
npm run db:migrate:local      # create the local D1 database
node scripts/build-seed.ts    # seed/data.ts -> seed/seed.sql
npm run db:seed:local         # load menu, nights, seasons, settings
npm run dev                   # http://localhost:4321 (runs in the background)
npx astro dev stop            # stop it
```

Local dev runs D1, KV, R2 and the KitchenRoom Durable Object on your machine.
Workers AI only exists on Cloudflare: set `CLOUDFLARE_API_TOKEN` to reach it
through the remote proxy; without the token everything else still works.

## Checks

```sh
npm test          # vitest: domain core and seed consistency
npm run check     # astro check + tsc
npm run build
```

## Layout

| Path | What |
|---|---|
| `src/domain/` | Pure, tested core: `pricing` (cart totals, ITBIS + service, zones), `schedule` (Bávaro clock, open now, nights, seasons), `capacity` (reservations). No I/O. |
| `src/server/` | D1 loaders, the `KitchenRoom` Durable Object. |
| `src/pages/[lang]/` | Localized pages (`en`, `es`, `fr`, `de`). `/` negotiates the language. |
| `src/i18n/ui.ts` | Interface text. Menu and offer text lives in D1. |
| `src/styles/global.css` | The default "Sound System" skin as CSS variables; seasons override them per request. |
| `migrations/` | D1 schema. |
| `seed/data.ts` | Launch content from Mezcalito's own menu. `UNCONFIRMED` lists what the owner must check. |
| `src/worker.ts` | Worker entry: Astro's handler, the Durable Object export, the cron. |

## Money and time

- Money is integer **centavos** everywhere (RD$1 = 100).
- Dates are `YYYY-MM-DD` and times `HH:MM` in **America/Santo_Domingo**;
  `24:00` is the midnight that ends a day, and a close at or before the open
  runs past midnight.

## Deploying

`main` deploys from GitHub Actions once the repository has the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets. Before the first
deploy, create the D1 database (`wrangler d1 create mezcalito`) and put its id
in `wrangler.jsonc`.
