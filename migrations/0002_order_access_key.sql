-- Order codes are short enough to read out over the phone, which also makes
-- them guessable. The status page shows personal details only to whoever
-- holds the link with this random key.
ALTER TABLE orders ADD COLUMN access_key TEXT;
