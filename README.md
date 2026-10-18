# Mezcalito: research report and website plan

## Context
**Mezcalito Bar & Grill** (Jamaican–Mexican fusion, Calle Pedro Mir, Bávaro, Punta Cana) has **commissioned** a new website. The goal is more than a brochure. It needs:
- own online ordering, with pickup, delivery or dine-in, paid on pickup or online
- table reservations
- specials and offers staff can market themselves, plus seasonal "skins" that re-theme the hero, the home page and a dedicated page for each season
- a Cloudflare Workers AI dish adviser
- a voiced, branching guided journey with a music bed
- strong mobile, performance and SEO

**Decisions so far:**
- The build is **brand-new** in its own repo, `joehannes/restaurante_mexicano_mezcalito` (currently empty), with its own ideas and architecture and nothing shared with nahiatours.
- **Concept:** "Sound System". **Stack:** Astro + React islands on Cloudflare Workers.
- **Languages at launch:** EN, ES, FR and DE. **Ordering:** our own checkout, paid on pickup or online.
- **Visuals:** illustration and texture carry the concept; Mezcalito's real food and venue photos sell the plates.
- **Playfulness:** "playful but quick". Home, Tonight, Season, Selector and Radio carry full motion and personality. Menu, cart and checkout stay calm, plain and fast, with the concept only in accents (badge stickers, the cart-pill bounce).
- **Independence from nahiatours:** the research was done on Mezcalito directly (their site, source code, menu, photos, video frames, reviews, competitors). The architecture below assumes nothing from nahiatours and reuses none of its code.

---

## PART A — Research findings

### A1. Identity and contact (from their own site's source, 18 Oct 2026)
| Field | Value | Source |
|---|---|---|
| Name | **Mezcalito Bar and Grill**. Also used: "Mezcalito RD", "Mezcalito Kitchen & Bar" | site, Tripadvisor, Restaurant Guru |
| Taglines | "Jamaican Mexican Fusion" · "One love. Mucho sabor." · "Home of the MEGA Drinks" · "Life is better with a good taco in hand!" | site |
| Address | **Calle Pedro Mir, Bávaro, La Altagracia**, about one block from the beach (Los Corales / El Cortecito side). Map embed is centred at 18.69218, −68.42596 | footer, Maps embed |
| Former location | Shared a space at **Hotel Cortecito Inn** ("pronel family y mezcalito"). TikTok: "new location 📍Calle Pedro Mir" | hotels.com, TikTok |
| Phone | **809-959-3794** (site) · **+1 809-959-1646** (Facebook, Google, Restaurant Guru) · +1 809-493-2864 (Uber Eats) | ⚠ three numbers |
| WhatsApp | **+1 809-212-0782** | site |
| Email | **info@mezcalitobarandgrill.com** | site |
| Hours | **Daily 8:00 AM – 12:00 AM** | Uber Eats, Restaurant Guru, TikTok |
| Web | mezcalitobarandgrill.com: static HTML/CSS/JS with an EN/ES toggle, built by agency "VAS" | site |
| Social | IG **@mezcalitord** · TikTok **@mezcalitodomrep** · FB **mezcalitord** | site |
| Delivery | **Uber Eats** and **PedidosYa** | site |
| People | Owner: "a proud Jamaican", named **Blake** in reviews (unverified). Staff named in reviews: Isa/Isah (server, praised), Alexa, Oscar, Peter | about page, reviews |

### A2. Mission (their own words)
> "Welcome to Mezcalito Bar and Grill, where island vibes meet Latin soul… Every dish is a celebration of culture: from Jerk Pork tacos, Quesabirria, to Ackee and saltfish tostones… fresh ingredients, traditional recipes, and modern techniques… the music is lively, the cocktails are bold… the perfect blend of Caribbean spice and Mexican heat. **One love. Mucho sabor.**"

### A3. Full menu (RD$; prices exclude **18% ITBIS + 10% service**)
- **Appetizers:**
  - Ackee & saltfish tostones 485 · Boneless bites 550 · Wings (6) 595 · Bacon jalapeño taquitos 499
  - Nachos 499 (+chicken 140 / +shrimp 160 / +beef 170) · Guacamole & chips 485 · Stamp & Go 495
  - Crispy shrimp 599 · Calamari 550 · Loaded fries 650
- **Rasta Pasta:** chicken 1,199 · shrimp 1,399 · goat 1,495 · oxtail 1,595 · chicken & shrimp 1,699 · lobster (seasonal) 1,995
- **Specialties** (each with a side):
  - Jerk chicken 1,199 / pork 1,295 · Curried goat 1,595 · **Braised oxtail 1,799**
  - Fajitas 599–825 · Fried chicken (3) 695
- **Tacos & more:**
  - Tacos: beef 495 · chicken 350 · oxtail 495 · jerk pork 390 · shrimp 485 · curried goat 389
  - **Quesabirria 595** · Quesadillas 490–595
- **Seafood:** shrimp ceviche 795 · saucy shrimp 985 · fish your way (escovitch, fried, steamed or brown stew) 1,450/lb · lobster (curried, garlic butter or fried) 1,985/lb
- **Bowls & wraps:** Fusion Bowl 535 (+protein, +ackee 140) · jerk chicken pineapple wrap 599 · burritos 499–749
- **Burgers:** classic 569 · bacon BBQ 600 · crispy chicken sandwich 490
- **Salads:** garden 499 · Caesar 390
- **Kids:** chicken tenders 350 · fish fingers 450
- **Sides:** 200 each (rice & peas, white rice, black beans, steamed veg, ripe plantain, fries, tostones, mash, mac & cheese, **festival**)
- **Desserts:** Droodie cookies 300 · vanilla flan 450 · Jamaican bread pudding 529
- **Drinks:** juices 200–250 · sodas 100. Cocktails, MEGA drinks, rum punch, margaritas and hookah have **no listed prices**.

### A4. Specials and recurring nights (⚠ their own pages contradict each other)
| Day | Offer | RD$ |
|---|---|---|
| Daily | Happy hour: ½-off margaritas & martinis (reviews say 5–9 pm; old footer says 2–11 pm) | 175 |
| Tue | **Taco Tuesday** all day: shrimp, beef, chicken, oxtail | 199 |
| Wed | Wingsday · Karaoke Wednesday | 899 |
| Thu | **Ladies Night**: Rasta Pasta + wine | 999 |
| Sat | **Unlimited Hookah** | 2,999 |
| Sun | **Brunch & Bubbly**: bottomless mimosas · **Rum & Reggae** 6–10 pm · Karaoke Sunday: ½-off rum punch | 699 / 350 |
| Any | Tasting flight · catering and private parties | 779 / form |

### A5. Look, decor, vibe and music (from their photos and 49-second promo video, reviewed frame by frame)
- **Logo:** a dreadlocked Rasta face, half of it a **calavera**, under a sombrero in Rasta green, gold and black. The wordmark has an angular orange-to-red gradient. ⚠ The face reads as a **Bob Marley likeness**, which is a legal risk.
- **Facade:** a white open-air terrace with columns, a black "MEZCALITO" fascia, red pavers and palms.
- **Inside:**
  - a "**ONE LOVE**" mural, an exposed brick wall with the **DJ booth**, track lights and fans
  - a backlit bottle bar with sports TVs (the World Cup was shown there), a string-lit terrace at night
  - gold beer buckets (Corona, Red Stripe, Presidente) and branded tin buckets
- **Seasonal decor is real:** photos show Easter eggs and Christmas garlands. **Food styling:** rustic boards, steel pots, chili-salt rims, edible flowers.
- **Crowd and mood:** young, social, strongly Afro-Caribbean and diaspora. Birthday sparklers, hookah, MEGA drinks, DJ nights, karaoke.
- **Music:** reggae, dancehall, afrobeats and Latin.

### A6. What guests say
- **Ratings:** Google **4.6★ (~1,150)** · Restaurant Guru **#13 of 1,030 bars in Punta Cana** and **#1 for oxtail in Punta Cana** · Tripadvisor 1 review, so it's under-indexed there.
- **Praised:** **oxtail** and **oxtail Rasta Pasta**, ceviche, birria tacos, "authentic Jamaican", MEGA drinks, staff (Isa), music, atmosphere, terrace, value.
- **Complaints:**
  - small portions on some dishes, and items out of stock (ackee & saltfish, and tequila during happy hour)
  - advertised deals not honoured
  - → a **live sold-out switch and one source of truth for deals** would fix a real pain point.

### A7. Current site: audit
- Header and footer are injected by JS fetch, so crawlers see no navigation, address or hours. There is no JSON-LD.
- "Order Now" points nowhere. The home page shows no hours, prices or phone number.
- The **reviews widget is broken** (Elfsight `APP_VIEWS_LIMIT_REACHED`).
- Typos, hidden template copy left over, stock photos on the deals, and an **8.5 MB autoplay hero video**.
- There is no booking system and no ordering of its own.

### A8. Competitors and benchmarks
- **Local:**
  - **Wacamole** (the most-recommended Mexican spot, live music Wed/Sun), Pastrata, Don Camarón (El Cortecito), Onno's
  - beachfront: Jellyfish, Huracán Café
  - oxtail rivals: La Bruja Chupadora, CARI-CUISINE, Asadero Doña Pula
- **"JaMexican" peers:** Chilitos (Kingston) and Papi Chulo (Ocho Rios). Neither has a strong website, so **nobody owns "Jamaican-Mexican" online**.
- **Benchmarks:**
  - **Turtle Bay UK:** each offer (brunch, 2-4-1, Island Nights, After Dark) gets its own section with one CTA, an almost one-to-one fit for Mezcalito's week
  - **Tacombi:** playful illustration, a featured-promo badge, a menu preview of six items, events
  - **Miss Lily's:** DJs, a Spotify playlist, a simple booking form, heritage voice
  - **Sweetgreen / Chipotle:** builder-style ordering · **Dishoom:** storytelling

Sources:
- Mezcalito's own pages: [mezcalitobarandgrill.com](https://mezcalitobarandgrill.com/) · [menu](https://mezcalitobarandgrill.com/menu.html)
- Listings and reviews: [Restaurant Guru](https://restaurantguru.com/Mezcalito-Kitchen-Bar-Punta-Cana) · [RG oxtail](https://restaurantguru.com/oxtail-Punta-Cana-m354) · [Tripadvisor](https://www.tripadvisor.com/Restaurant_Review-g147293-d34013415-Reviews-Mezcalito_RD-Punta_Cana_La_Altagracia_Province_Dominican_Republic.html) · [Uber Eats](https://www.ubereats.com/do-en/store/mezcalito-bar-and-grill-punta-cana/Wqf2ad_DXYeWDoK7TzYL-w) · [Wheree](https://mezcalito-bar-and-grill.wheree.com/) · [Atmosfy](https://atmosfy.io/location/el-cortecito/mezcalito-3426162) · [Mario Fama RD](https://www.mariofamard.com/mezcalito-restaurant-and-bar-jamaican-infused-mexican-kitchen/)
- Social: [TikTok](https://www.tiktok.com/@mezcalitodomrep) · [Facebook](https://www.facebook.com/p/mezcalitord-100064275751852/) · [Instagram](https://www.instagram.com/mezcalitord/)
- Competitors and benchmarks: [Holiday Hypermarket](https://www.holidayhypermarket.co.uk/destinations/caribbean/dominican-republic/bavaro/best-restaurants) · [Wanderlog](https://wanderlog.com/list/geoCategory/777246/best-mexican-foods-and-restaurants-in-punta-cana) · [Turtle Bay](https://www.turtlebay.co.uk/) · [Tacombi](https://www.tacombi.com/) · [Miss Lily's](https://www.misslilys.com/) · [Papi Chulo](https://jamaica-gleaner.com/article/food/20240404/papi-chulo-restaurant-brings-ja-mexican-flavours-ocho-rios)
- Cloudflare: [Workers AI models](https://developers.cloudflare.com/workers-ai/models/) (aura-2-en/es, melotts, llama-3.3-70b, bge-m3)

---

## PART B — Concept: "Mezcalito Sound System" (chosen)

**The idea.** Jamaica has the *sound system* (selector, flyers, speaker stacks). Mexico has the *sonidero* (the cumbia sound system with hand-painted posters). Both cultures share street posters and music that moves a whole street, and Mezcalito already lives this with its DJ booth, Rum & Reggae, karaoke and "One love". So:
- **The weekly nights are flyers on a line-up wall,** in dancehall-flyer and *rótulo* sign-painter style. Swiping through them is flipping the flyer wall.
- **A season is a "new rotation."** Staff publish a new flyer set and palette, and the hero, home and `/season/<slug>` page change with it. Presets:
  - **Día de Muertos (1–2 Nov)**: the logo is already half calavera
  - Navidad Caribeña · Carnaval DR (Feb) · Reggae Month / Feb 6
  - Cinco de Mayo · Jamaica Independence (6 Aug) · Mexican Independence (16 Sep) · big-game nights
- **The AI is "The Selector,"** who picks your plate the way a selector picks the record.
- **The bridge in one word: *jamaica*.** In Mexico the hibiscus drink is *agua de jamaica*, and in Jamaica the same flower is *sorrel*. It is the palette anchor (hibiscus pink) and a suggested signature drink.
- **The split from the logo:** a diagonal layout with the JA half in green, gold and black and the MX half in rosa mexicano and marigold. Each dish gets a **Fusion dial** (🇯🇲 ↔ 🇲🇽) and a **heat scale** (scotch bonnet ↔ habanero).
- **The metaphor is decoration only.** Labels stay literal ("Menu", "Order", "Book a table", "Add"). Someone who just wants to eat goes from home to the menu in one tap, adds items in one tap, and checks out in about three steps.

**Visual system:**
- **Palette:** ink (speaker black) · masa cream · Rasta gold / cempasúchil · hibiscus pink · Rasta green · wordmark orange · Caribbean turquoise · mezcal purple. All are **CSS custom properties**, so a season re-skins at runtime with no rebuild.
- **Type:** a condensed poster display face for flyers (e.g. Anton or Bowlby One), a hand-painted accent for prices and stickers, and a highly legible sans for body and menu text. Self-hosted and subset.
- **Texture:** papel picado cut-outs, halftones, brush underlines, sticker badges ("NEW", "SOLD OUT", "MEGA").

**Motion** (transform and opacity only; honours `prefers-reduced-motion`):
- **Effects:** a speaker-cone pulse on the main CTA · flyer cards that tilt and shuffle · a swaying papel picado garland · a split-wipe page transition (the JA and MX halves slide apart, via Astro View Transitions) · a vinyl spin while the Selector thinks · a cart pill that bounces when an item lands.
- **Time-aware hero** (America/Santo_Domingo time), set in the illustrated white-column facade:
  - morning: breakfast and brunch · midday: beach lunch · 5–9 pm: happy-hour countdown
  - night: the terrace lights come on, with "Tonight: Rum & Reggae" and "Open now · closes 12 am"
- The facade's terrace bays frame "Now serving", "Tonight" and "Book".

---

## PART C — Features

**Guest-facing:**
1. **The menu is the order page.** A sticky category rail and search. Filter chips: spicy, vegetarian, seafood, kids, first time trying Jamaican. Each item shows its heat and fusion badges. Tapping an item opens a bottom sheet with modifiers (protein, side, style, per-lb weight) and a one-tap add. **Sold-out** status is live.
2. **Checkout:**
   - Modes: **Pickup**, **Delivery** (zone polygons and fees around Pedro Mir), or **Dine-in** (table QR `?t=12`). Timing: ASAP or scheduled within opening hours.
   - The guest gives a name and WhatsApp number.
   - Payment: cash or card on pickup/delivery, or **online** through a DR gateway (Azul Payment Page first, PayPal second, behind a provider interface).
   - Totals show **ITBIS 18% + service 10%** and a USD estimate. The server re-prices everything. Uber Eats and PedidosYa remain as fallbacks outside the zone.
3. **Live order status** `/o/:code`: received → preparing → ready / on the way → done. It updates in real time and gives WhatsApp confirmation links.
4. **Reservations:**
   - party size, date, slots checked against capacity
   - occasion (birthday → **sparklers and cake** add-on), seating (terrace, inside, by the DJ), notes
   - event nights can have separate capacity or a deposit
   - confirmation by WhatsApp and email, plus an `.ics` file
5. **Tonight / This week:** the flyer wall of nights and offers, filtered by day and time, with "Happening now" badges.
6. **Season pages** `/season/:slug`: story, special menu, event night, booking CTA, gallery, playlist link, and generated OG share images.
7. **The Selector (AI):** chips or free text for taste, heat, budget per person, group, diet and hunger, in four languages. It returns **three picks plus a drink**, with reasons and an "add all" button.
8. **Mezcalito Radio** (opt-in voice journey): a branching path of four or five questions, read by a recorded voice over a ducked, licensed reggae/cumbia bed, that ends in a ready-to-order plate. Answer by tap or voice, skip at any time, and **no sound ever autoplays**. "Statistically assembled" means options are ordered by what past guests chose on each branch.
9. Parties & catering request · Our story (the owner, the One Love mission) · Gallery (real photos and short reels) · curated Google reviews · Find us (map deep link, "one block from the beach").
10. **Mobile extras:**
    - a thumb-zone bottom bar (Menu · Order · Book · Tonight), click to call and WhatsApp, Web Share for a dish, light haptics
    - an installable PWA with an offline menu
    - QR "at the table" mode with call-waiter and request-the-bill

**Staff (`/admin`, phone-first, sign-in through Cloudflare Access):**
- **Menu:** items, modifiers, photos uploaded to R2, a **one-tap "86 it" sold-out toggle**, availability by daypart, AI-drafted translations that staff review.
- **Nights & offers:** recurrence (weekdays and time window, date range), price, flyer art, CTA. This is the single source of truth, read by home, Tonight, JSON-LD and the Selector.
- **Seasons:**
  - pick a preset or edit palette tokens, hero media and headline, home blocks, page content and playlist
  - set a start/end schedule, preview, then publish
  - themed server-side, so the first paint and OG tags already match the season
- **Orders board:** a real-time queue with status buttons, a sound alert and Web Push. Kitchen role sees only this.
- **Reservations:** a calendar, capacity per slot, blackout dates.
- **Settings:** hours, holidays, contact details (fixes the three-number problem), delivery zones, tax and service, payment providers.
- **Radio editor:** the node tree, plus a "render voice" button per line.
- **Insights:** orders, top items, conversion funnel, Selector and Radio path stats.

**Guest journeys** (shortest path first; the concept never sits in the way):
1. **Just order:** land → "Order" (top bar and bottom bar) → menu → item sheet → Add → cart pill → checkout (pickup, delivery or table · time · name and WhatsApp · cash or online) → live status page. About four taps.
2. **Not sure what to eat:** "Let The Selector pick" → three or four chips or free text, or the Mezcalito Radio voice path → three picks and a drink → Add all → checkout, or book a table.
3. **Planning a night out:** Tonight → event flyer → Book a table (party size, time, occasion; birthdays get the sparkler add-on) → WhatsApp confirmation → reminder.
4. **At the table:** scan the QR → table mode → order to the table, call the waiter, or ask for the bill.
5. **From Instagram or TikTok to a season:** `/season/:slug` → story → special menu → Book or Order.
6. **Returning guest:** installed PWA → "Order last time's food again" → happy-hour countdown.

---

## PART D — Architecture (fresh repo)

**Stack:**
- **Astro 5** (server output, `@astrojs/cloudflare` adapter) with **React 19 islands** for the cart, item sheet, checkout, reserve, Selector, Radio and the admin app.
- **Tailwind CSS v4**, with `@theme` tokens pointing at CSS variables. TypeScript strict mode.
- **Hosting:** Cloudflare Workers with static assets.

**Cloudflare bindings (`wrangler.jsonc`):**
| Binding | Use |
|---|---|
| **D1** `mezcalito` | menu, modifiers, i18n strings, specials, seasons, settings, orders, order_items, order_events, reservations, slot_rules, blackouts, radio_nodes. Migrations live in `migrations/*.sql`. |
| **KV** `CACHE` | `content-version` counter, used to bust edge-cached SSR pages the moment staff save |
| **R2** `MEDIA` | photos, flyers, voice clips, music beds. Served through Image Transformations (`format=auto`, width variants). |
| **Durable Object** `KitchenRoom` | WebSocket hub (Hibernation API) that pushes new orders to the board and status changes to the guest page |
| **Workers AI** `AI` | Selector (llama-3.3-70b-instruct-fp8-fast, JSON mode), translation drafts, TTS rendering (aura-2-en, aura-2-es, melotts for FR) |
| **AI Gateway** | caching, logs and rate limits for AI calls |
| **Rate Limiting** + **Turnstile** | protect checkout, reservations and the Selector from bots |
| **Analytics Engine** `EVENTS` | funnel and Radio-path counts, which also feed the "popular choice" ordering |
| **Cron trigger** | expires unpaid online orders, sends reservation reminders, pre-warms the active season |

**Code layout:**
- `src/pages/[lang]/…`: Astro routes (`/en`, `/es`, `/fr`, `/de`; `/` negotiates the language). The routes:
  - `index`, `menu`, `menu/[item]`, `tonight`, `season/[slug]`, `reserve`, `selector`, `radio`
  - `parties`, `story`, `find-us`, `o/[code]`, `admin/*`
- `src/pages/api/…`: `menu`, `order` (create, status, pay-return), `reserve` (slots, create), `selector`, `radio/stats`, `admin/*`, `ws/kitchen`.
- `src/domain/` (pure, no I/O, fully unit-tested):
  - `pricing.ts`: modifiers, per-lb items, ITBIS + service, delivery fee, USD estimate
  - `schedule.ts`: open now (including past midnight), active nights, active season, America/Santo_Domingo
  - `capacity.ts`: reservation slots · `selectorScore.ts`: deterministic fallback and id validation
  - `radioTree.ts`: walking the tree, scoring outcomes
- `src/server/`: D1 repositories, `notify/` (WhatsApp Cloud API templates with wa.me fallback; Resend email), `payments/` (provider interface → `azul.ts`, `paypal.ts`, `cash.ts`), `ai/`, `access.ts` (verifies the `Cf-Access-Jwt-Assertion` header and roles: owner, manager, kitchen).
- `src/i18n/`: EN, ES, FR, DE UI dictionaries. Content translations live in D1.
- `src/styles/tokens.css`: the default skin. Seasons inject overriding variables server-side in `<head>`.
- `seed/`: the menu, nights and settings from Part A as SQL or JSON seeds.

**Key flows:**
- **Order:**
  1. The island posts the cart.
  2. The server re-prices it from D1 with `domain/pricing` and checks hours, zone and sold-out items.
  3. It inserts the order with a short code, then notifies the `KitchenRoom` DO, staff WhatsApp and email.
  4. Online pay: redirect to Azul, then verify the signed return, then mark paid. Cash: confirm straight away.
- **Reserve:** a slot query, then a single D1 batch that re-checks capacity and inserts (D1 is serialised per database). Then the confirmation message and `.ics`.
- **Selector:**
  1. The compact menu (about 90 items, already filtered to what is available now) plus the guest's preferences go to the model.
  2. The model answers in JSON with `{picks:[{id,why}], drink, note}`.
  3. The server validates every id, the budget and allergens. On failure or timeout, `selectorScore` answers instead, so there is always a result in under a second or two.
- **Seasons:** `schedule.ts` resolves the active season per request. The SSR layout injects its tokens, hero and OG. Pages are edge-cached and keyed by `content-version`.
- **Voice:**
  - Each Radio line is rendered once to MP3 in R2 (Aura-2 for EN/ES, MeloTTS for FR).
  - **German has no Workers AI voice:** render DE with an external TTS or record it, and use device speech as the fallback.
  - Lines are fingerprinted, so changed copy falls back to device TTS until it is re-rendered.
  - The music bed runs through Web Audio with gain ducking.

**SEO:**
- Real server-rendered HTML per language with `hreflang` and canonical tags.
- **JSON-LD:** `Restaurant` (servesCuisine, priceRange, geo, `openingHoursSpecification`, `acceptsReservations`, `hasMenu` → `MenuSection` / `MenuItem` / `Offer`, `sameAs`) plus `Event` for each night and season.
- A sitemap per language and per-season OG images.
- Landing intents: "Jamaican food Punta Cana", "oxtail Bávaro", "tacos El Cortecito", "comida jamaicana Bávaro", "rasta pasta Punta Cana".
- **301s from the old URLs** (`menu.html`, `daily.html`, `about.html`, `catering.html`, `contact.html`). An NAP-consistency checklist for Google Business Profile, Tripadvisor (claim it), Uber Eats and Facebook.

**Performance budgets** (throttled Pixel 5, 4× CPU):
- Home JS ≤ 90 KB gzip, LCP ≤ 2.0 s, CLS ≤ 0.05, INP ≤ 200 ms.
- A poster-first hero; video only on wide screens, decided in JS.
- Lazy images with width variants, two or three subset fonts, no `backdrop-filter` on sticky bars.

**Delivery tooling:**
- npm scripts: `dev`, `build`, `check` (astro check + tsc), `lint` (eslint, prettier), `test` (vitest), `test:workers` (vitest-pool-workers against D1 and the DO), `e2e` (Playwright), `perf`.
- GitHub Actions: check, test, build, `wrangler d1 migrations apply`, deploy. Preview URLs come from Worker versions per branch.

## Phases
1. **Scaffold:** Astro and the Cloudflare adapter, Tailwind tokens, i18n routing, wrangler bindings, D1 schema and migrations, seeds from Part A, CI. Domain modules with tests first (pricing, schedule, capacity).
2. **Order-first public site:**
   - Home: time-aware facade hero, Tonight strip, signatures (oxtail, Rasta Pasta, quesabirria, jerk taco), reviews, find us
   - Menu and order, cart and checkout (cash/card on pickup), live order status, Reserve, Tonight, Story, Parties, Find us
   - JSON-LD and the sitemap
3. **Staff admin:** Access, roles, menu with sold-out toggle, nights and offers, orders board (DO WebSocket plus push), reservations, settings, R2 uploads.
4. **Online payments** (Azul, then PayPal) and WhatsApp Cloud API templates.
5. **Seasons:** the editor and presets. **Día de Muertos ships first** if the timing allows; otherwise Navidad Caribeña.
6. **The Selector,** then **Mezcalito Radio** with voice rendering and the music bed.
7. **Polish:** PWA and offline menu, QR table mode, insights, perf pass, FR and DE copy review, domain cutover and 301s.

## Verification
- `npm run check && npm run lint && npm test`. Vitest covers `domain/*`: modifiers and per-lb pricing, ITBIS + service rounding, delivery zones, open-now across midnight, nights by weekday and time, season precedence, slot capacity, selector id validation and fallback, radio tree outcomes.
- `npm run test:workers`: order create → D1 row → DO broadcast; booking until full, then the next booking is rejected; Access JWT rejection on `/api/admin/*`.
- `wrangler dev` with local D1: place a full order end to end and watch the board update live. Book a table. Publish a season and see the home re-skin without a rebuild.
- Playwright on Pixel 5 at 4× CPU: home → menu → add → checkout in ≤ 4 taps, the budgets above, the reduced-motion path, all four languages render.
- Google Rich Results test for Restaurant, Menu and Event. Lighthouse SEO and a11y ≥ 95.

## Prerequisites and open items
- **Push access** to `joehannes/restaurante_mexicano_mezcalito`. The session currently has read-only access, and the repo is empty. Connect GitHub and install the Claude app on it, then re-attach.
- **Cloudflare account and API token** for the new Worker, D1, R2 and DO. **Domain:** take over mezcalitobarandgrill.com from VAS (needs DNS access) or use a new domain.
- **To confirm with the owner:** the correct phone and WhatsApp numbers, hours, happy-hour times, drink and cocktail prices, delivery zone and fees, and the payment gateway account (Azul merchant ID or PayPal).
- **Brand:** the Marley-likeness logo is a legal risk. Recommend a stylised, non-likeness Rasta-calavera mark for the new site.
- **Content:** real photo and video access (Instagram and TikTok originals), a licensed music bed, and a German voice source.