-- Rendered voice clips per question (locale -> fingerprint of the text they
-- were made from), and how often each answer is chosen, which orders the
-- answers for the next guest.
ALTER TABLE radio_nodes ADD COLUMN voice TEXT NOT NULL DEFAULT '{}';
CREATE TABLE radio_choices (
  node_id    TEXT NOT NULL,
  option_id  TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (node_id, option_id)
);
