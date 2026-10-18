-- Parties, big groups and catering: a request the staff follow up by hand.
CREATE TABLE party_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  kind        TEXT NOT NULL CHECK (kind IN ('birthday', 'group', 'corporate', 'catering', 'other')),
  guests      INTEGER NOT NULL CHECK (guests > 0),
  date        TEXT NOT NULL,
  time        TEXT,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  message     TEXT,
  locale      TEXT NOT NULL DEFAULT 'en',
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'booked', 'declined'))
);
CREATE INDEX party_requests_status ON party_requests (status, created_at);
