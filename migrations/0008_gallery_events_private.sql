-- The polaroid wall, marketing events, and values that must never reach a
-- guest page (the admin password, payment credentials). `settings` is read
-- whole into every public page, so none of these may live there.

-- Photos and short clips pinned to the polaroid wall, in staff's order.
CREATE TABLE gallery (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo', 'video')),
  src         TEXT NOT NULL,             -- /img/… or /media/…; an mp4 for a video
  poster      TEXT,                      -- a still for a video
  caption     TEXT NOT NULL,             -- localized JSON, written on the polaroid
  tilt        REAL NOT NULL DEFAULT 0,   -- degrees, -12…12
  on_home     INTEGER NOT NULL DEFAULT 1,
  published   INTEGER NOT NULL DEFAULT 1,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX gallery_position ON gallery (published, position);

-- One-off marketing events with their own page: a launch, a big match, a
-- guest DJ. The live one (published, today in range) is featured on home.
CREATE TABLE events (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,             -- localized JSON
  kicker      TEXT,                      -- localized JSON
  body        TEXT,                      -- localized JSON
  starts_on   TEXT NOT NULL,
  ends_on     TEXT NOT NULL,
  start_time  TEXT,                      -- HH:MM, shown only
  end_time    TEXT,
  price       INTEGER,                   -- centavos, the headline price
  image       TEXT,
  video       TEXT,
  cta         TEXT NOT NULL DEFAULT 'book' CHECK (cta IN ('order', 'book', 'whatsapp', 'link', 'none')),
  cta_url     TEXT,
  cta_label   TEXT,                      -- localized JSON
  highlights  TEXT NOT NULL DEFAULT '[]',-- [localized JSON]
  color       TEXT NOT NULL DEFAULT 'hibiscus',
  published   INTEGER NOT NULL DEFAULT 0,
  priority    INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE private_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,             -- JSON
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- The wall at launch: stills and two loops from Mezcalito's own promo film.
INSERT INTO gallery (kind, src, poster, caption, tilt, on_home, position) VALUES
  ('photo', '/img/polaroids/welcome.webp', NULL, '{"en":"¡Bienvenidos!","es":"¡Bienvenidos!","fr":"¡Bienvenidos!","de":"¡Bienvenidos!"}', -4, 1, 1),
  ('video', '/video/polaroid-terrace.mp4', '/video/polaroid-terrace-poster.webp', '{"en":"Full house on the terrace","es":"Terraza llena","fr":"Terrasse bondée","de":"Volle Terrasse"}', 3, 1, 2),
  ('photo', '/img/polaroids/dj-booth.webp', NULL, '{"en":"Selector in the house","es":"El selector en casa","fr":"Le selector est là","de":"Der Selector ist da"}', -2, 1, 3),
  ('photo', '/img/polaroids/sip.webp', NULL, '{"en":"Sip, sip, hooray","es":"Sorbito y a gozar","fr":"Une gorgée, et la fête","de":"Ein Schluck, ein Fest"}', 5, 1, 4),
  ('photo', '/img/polaroids/riddim.webp', NULL, '{"en":"Karaoke & riddim nights","es":"Noches de karaoke y riddim","fr":"Soirées karaoké & riddim","de":"Karaoke- & Riddim-Nächte"}', -6, 1, 5),
  ('photo', '/img/polaroids/buckets.webp', NULL, '{"en":"Ice-cold buckets","es":"Cubetas bien frías","fr":"Seaux bien frais","de":"Eiskalte Eimer"}', 2, 1, 6),
  ('video', '/video/polaroid-sparklers.mp4', '/video/polaroid-sparklers-poster.webp', '{"en":"Birthday sparklers!","es":"¡Bengalas de cumpleaños!","fr":"Feux de bengale d’anniv !","de":"Geburtstags-Wunderkerzen!"}', -3, 1, 7),
  ('photo', '/img/polaroids/hookah.webp', NULL, '{"en":"Hookah clouds","es":"Nubes de hookah","fr":"Nuages de chicha","de":"Shisha-Wolken"}', 4, 1, 8),
  ('photo', '/img/polaroids/bartender.webp', NULL, '{"en":"Shaken with love","es":"Batido con amor","fr":"Secoué avec amour","de":"Mit Liebe geschüttelt"}', -5, 1, 9),
  ('photo', '/img/polaroids/game-night.webp', NULL, '{"en":"Game night on the big screen","es":"Partido en pantalla grande","fr":"Match sur grand écran","de":"Spieltag auf der Leinwand"}', 3, 0, 10),
  ('photo', '/img/polaroids/memories.webp', NULL, '{"en":"Making memories","es":"Creando recuerdos","fr":"Des souvenirs à la pelle","de":"Erinnerungen machen"}', -2, 0, 11),
  ('photo', '/img/polaroids/laughs.webp', NULL, '{"en":"Laughing till midnight","es":"Riendo hasta medianoche","fr":"Rire jusqu’à minuit","de":"Lachen bis Mitternacht"}', 6, 0, 12),
  ('photo', '/img/polaroids/full-house.webp', NULL, '{"en":"Friends, food, one love","es":"Amigos, comida, one love","fr":"Amis, bouffe, one love","de":"Freunde, Essen, One Love"}', -4, 0, 13),
  ('photo', '/img/polaroids/sparklers.webp', NULL, '{"en":"Make a wish","es":"Pide un deseo","fr":"Fais un vœu","de":"Wünsch dir was"}', 2, 0, 14);

-- A first event to start from, in step with the Día de Muertos season
-- already published for 24 Oct – 3 Nov. Staff edit or unpublish it under
-- Admin → Events.
INSERT INTO events (slug, title, kicker, body, starts_on, ends_on, start_time, end_time, image, video, cta, highlights, color, published, priority) VALUES (
  'noche-de-muertos',
  '{"en":"Noche de Muertos","es":"Noche de Muertos","fr":"Noche de Muertos","de":"Noche de Muertos"}',
  '{"en":"Día de Muertos weekend at Mezcalito","es":"Fin de semana de Día de Muertos en Mezcalito","fr":"Le week-end du Día de Muertos chez Mezcalito","de":"Día-de-Muertos-Wochenende im Mezcalito"}',
  '{"en":"Marigolds on the bar, calaveras on the walls and the selector on the decks till midnight. Bring your crew, toast the ones you remember, and do it Jamaican-Mexican style.\n\nCome as you are — or as your best catrina or calavera. Book a table for the terrace before it fills up.","es":"Cempasúchil en la barra, calaveras en las paredes y el selector en los platos hasta medianoche. Trae a tu gente, brinda por los que recuerdas, y hazlo al estilo jamaiquino-mexicano.\n\nVen como eres, o como tu mejor catrina o calavera. Reserva tu mesa en la terraza antes de que se llene.","fr":"Des œillets d’Inde sur le bar, des calaveras aux murs et le selector aux platines jusqu’à minuit. Venez en bande, trinquez à ceux qu’on n’oublie pas, à la jamaïcaine-mexicaine.\n\nVenez comme vous êtes — ou en catrina ou calavera. Réservez votre table en terrasse avant qu’elle ne soit pleine.","de":"Studentenblumen an der Bar, Calaveras an den Wänden und der Selector an den Decks bis Mitternacht. Bring deine Leute mit, stoßt auf die an, an die ihr euch erinnert — jamaikanisch-mexikanisch.\n\nKomm, wie du bist — oder als Catrina oder Calavera. Reserviere einen Tisch auf der Terrasse, bevor sie voll ist."}',
  '2026-10-31', '2026-11-02', '18:00', '24:00',
  '/img/polaroids/sparklers.webp', '/video/polaroid-terrace.mp4', 'book',
  '[{"en":"Catrina & calavera face paint welcome","es":"Bienvenidas las caras de catrina y calavera","fr":"Maquillage catrina & calavera bienvenu","de":"Catrina- & Calavera-Schminke willkommen"},{"en":"The selector till midnight","es":"El selector hasta medianoche","fr":"Le selector jusqu’à minuit","de":"Der Selector bis Mitternacht"},{"en":"Karaoke on Sunday","es":"Karaoke el domingo","fr":"Karaoké le dimanche","de":"Karaoke am Sonntag"},{"en":"MEGA drinks","es":"Bebidas MEGA","fr":"Boissons MEGA","de":"MEGA-Drinks"}]',
  'sunset', 1, 10
);
