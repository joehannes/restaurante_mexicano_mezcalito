-- Mezcalito: menu, nights, seasons, settings, orders and reservations.
--
-- Guest-facing text is stored as JSON objects keyed by locale
-- ({"en": "...", "es": "..."}); English is the fallback. Money is integer
-- centavos. Dates are YYYY-MM-DD and times HH:MM, both Bávaro local time;
-- timestamps are ISO-8601 UTC.

CREATE TABLE categories (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,              -- localized JSON
  position  INTEGER NOT NULL DEFAULT 0,
  hidden    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE menu_items (
  id           TEXT PRIMARY KEY,
  category_id  TEXT NOT NULL REFERENCES categories(id),
  name         TEXT NOT NULL,           -- localized JSON
  description  TEXT,                    -- localized JSON
  price        INTEGER NOT NULL DEFAULT 0,
  unit         TEXT NOT NULL DEFAULT 'each' CHECK (unit IN ('each', 'lb')),
  heat         INTEGER NOT NULL DEFAULT 0 CHECK (heat BETWEEN 0 AND 5),
  fusion       INTEGER NOT NULL DEFAULT 0 CHECK (fusion BETWEEN -2 AND 2),
  tags         TEXT NOT NULL DEFAULT '[]',
  photo        TEXT,
  sold_out     INTEGER NOT NULL DEFAULT 0,
  hidden       INTEGER NOT NULL DEFAULT 0,
  position     INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX menu_items_category ON menu_items (category_id, position);

CREATE TABLE item_variants (
  item_id   TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  id        TEXT NOT NULL,
  label     TEXT NOT NULL,              -- localized JSON
  price     INTEGER NOT NULL,
  sold_out  INTEGER NOT NULL DEFAULT 0,
  position  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, id)
);

-- Modifier groups are shared ("side of choice" belongs to a dozen dishes),
-- so marking festival sold out marks it out everywhere at once.
CREATE TABLE modifier_groups (
  id     TEXT PRIMARY KEY,
  label  TEXT NOT NULL,                 -- localized JSON
  min    INTEGER NOT NULL DEFAULT 0,
  max    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE modifier_options (
  group_id  TEXT NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  id        TEXT NOT NULL,
  label     TEXT NOT NULL,              -- localized JSON
  price     INTEGER NOT NULL DEFAULT 0,
  sold_out  INTEGER NOT NULL DEFAULT 0,
  position  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, id)
);

CREATE TABLE item_modifier_groups (
  item_id   TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  group_id  TEXT NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, group_id)
);

-- Recurring nights and offers: the single source of truth for every deal.
CREATE TABLE specials (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,           -- localized JSON
  body         TEXT,                    -- localized JSON
  days         TEXT NOT NULL DEFAULT '[]',  -- weekdays, 0 = Sunday; [] = every day
  start_time   TEXT NOT NULL DEFAULT '00:00',
  end_time     TEXT NOT NULL DEFAULT '24:00',
  valid_from   TEXT,
  valid_to     TEXT,
  price        INTEGER,                 -- the headline price, if there is one
  image        TEXT,
  cta          TEXT NOT NULL DEFAULT 'order' CHECK (cta IN ('order', 'book', 'none')),
  item_ids     TEXT NOT NULL DEFAULT '[]',
  flyer        TEXT NOT NULL DEFAULT '{}', -- flyer art direction: colours, sticker, layout
  active       INTEGER NOT NULL DEFAULT 1,
  position     INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Seasonal "rotations": a skin for the whole site plus its own page.
CREATE TABLE seasons (
  slug          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,          -- localized JSON
  starts_on     TEXT NOT NULL,
  ends_on       TEXT NOT NULL,
  priority      INTEGER NOT NULL DEFAULT 0,
  published     INTEGER NOT NULL DEFAULT 0,
  tokens        TEXT NOT NULL DEFAULT '{}', -- CSS custom properties to override
  hero          TEXT NOT NULL DEFAULT '{}', -- headline, kicker, media, CTA
  blocks        TEXT NOT NULL DEFAULT '[]', -- season page sections
  playlist_url  TEXT,
  og_image      TEXT,
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Hours, closures, contact, pricing, delivery zones, reservation rules.
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,            -- JSON
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT NOT NULL UNIQUE,  -- short, readable, given to the guest
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  mode            TEXT NOT NULL CHECK (mode IN ('pickup', 'delivery', 'dine_in')),
  status          TEXT NOT NULL DEFAULT 'received'
                  CHECK (status IN ('awaiting_payment', 'received', 'preparing', 'ready', 'on_the_way', 'done', 'cancelled')),
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('cash', 'card_on_delivery', 'online')),
  payment_status  TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  payment_ref     TEXT,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  customer_email  TEXT,
  address         TEXT,                  -- JSON: street, reference, lat, lng
  zone_id         TEXT,
  table_label     TEXT,
  scheduled_for   TEXT,                  -- null = as soon as possible
  locale          TEXT NOT NULL DEFAULT 'en',
  notes           TEXT,
  subtotal        INTEGER NOT NULL,
  itbis           INTEGER NOT NULL,
  service         INTEGER NOT NULL,
  delivery_fee    INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL
);
CREATE INDEX orders_status ON orders (status, created_at);

CREATE TABLE order_items (
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  line_no     INTEGER NOT NULL,
  item_id     TEXT NOT NULL,
  variant_id  TEXT,
  qty         INTEGER NOT NULL,
  weight_lb   REAL,
  options     TEXT NOT NULL DEFAULT '{}',
  note        TEXT,
  name        TEXT NOT NULL,             -- snapshot of the name, as ordered
  unit_price  INTEGER NOT NULL,
  line_total  INTEGER NOT NULL,
  PRIMARY KEY (order_id, line_no)
);

CREATE TABLE order_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id  INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  status    TEXT NOT NULL,
  actor     TEXT                         -- staff email, 'guest' or 'system'
);
CREATE INDEX order_events_order ON order_events (order_id, at);

CREATE TABLE reservations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  date        TEXT NOT NULL,
  time        TEXT NOT NULL,
  party       INTEGER NOT NULL CHECK (party > 0),
  status      TEXT NOT NULL DEFAULT 'confirmed'
              CHECK (status IN ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  occasion    TEXT,
  seating     TEXT CHECK (seating IN ('terrace', 'inside', 'dj', 'any')),
  addons      TEXT NOT NULL DEFAULT '[]',
  notes       TEXT,
  locale      TEXT NOT NULL DEFAULT 'en'
);
CREATE INDEX reservations_date ON reservations (date, time);

-- Mezcalito Radio: the branching voice journey.
CREATE TABLE radio_nodes (
  id        TEXT PRIMARY KEY,
  prompt    TEXT NOT NULL,               -- localized JSON
  options   TEXT NOT NULL,               -- [{id, label, next?, traits}]
  position  INTEGER NOT NULL DEFAULT 0
);

-- Reviews the staff chose to show, copied from Google with the author's name.
CREATE TABLE reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  author     TEXT NOT NULL,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text       TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'google',
  date       TEXT,
  published  INTEGER NOT NULL DEFAULT 1,
  position   INTEGER NOT NULL DEFAULT 0
);
