-- What the R2 bucket holds and how often it was written today, so every
-- write can be refused before it would leave Cloudflare's free tier
-- (see src/server/media.ts).
CREATE TABLE media_usage (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  bytes   INTEGER NOT NULL DEFAULT 0,
  day     TEXT NOT NULL DEFAULT '',
  writes  INTEGER NOT NULL DEFAULT 0
);
INSERT INTO media_usage (id) VALUES (1);
