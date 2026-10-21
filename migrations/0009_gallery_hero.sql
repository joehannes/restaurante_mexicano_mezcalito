-- Polaroids can also hang on the string of lights across the home page's
-- hero, chosen under Admin → Polaroid wall ("In the hero").
ALTER TABLE gallery ADD COLUMN on_hero INTEGER NOT NULL DEFAULT 0;

UPDATE gallery SET on_hero = 1 WHERE src IN (
  '/img/polaroids/welcome.webp',
  '/video/polaroid-terrace.mp4',
  '/img/polaroids/dj-booth.webp',
  '/img/polaroids/sip.webp',
  '/video/polaroid-sparklers.mp4',
  '/img/polaroids/bartender.webp',
  '/img/polaroids/memories.webp'
);

-- The taco board and the One Love cocktail, so the food hangs up there too.
INSERT INTO gallery (kind, src, poster, caption, tilt, on_home, on_hero, position) VALUES
  ('photo', '/img/polaroids/tacos-board.webp', NULL, '{"en":"Taco Tuesday","es":"Martes de tacos","fr":"Mardi tacos","de":"Taco-Dienstag"}', -4, 0, 1, 4),
  ('photo', '/img/polaroids/one-love.webp', NULL, '{"en":"One love","es":"One love","fr":"One love","de":"One Love"}', 5, 0, 1, 7);
