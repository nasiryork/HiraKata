-- Private extra words, loaded into D1 only (never committed). The public repo ships the regular
-- bank in src/data/words.js; rows here are merged in by the API, placed right after `after_id`.
CREATE TABLE extra_words (
  id INTEGER PRIMARY KEY,   -- use 1001+ so it never collides with the public ids
  jp TEXT NOT NULL,
  kana TEXT NOT NULL,
  romaji TEXT NOT NULL,
  en TEXT NOT NULL,
  group_name TEXT NOT NULL,
  after_id INTEGER          -- slot in after this public word id (NULL = end of the bank)
);
