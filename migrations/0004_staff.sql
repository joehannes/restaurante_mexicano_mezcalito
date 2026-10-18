-- Staff who may use /admin, by the email Cloudflare Access signs them in
-- with. Owners named in the OWNER_EMAILS variable need no row here.
CREATE TABLE staff (
  email       TEXT PRIMARY KEY,          -- lower case
  name        TEXT,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'kitchen')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
