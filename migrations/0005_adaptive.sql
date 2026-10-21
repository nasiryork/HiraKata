-- Adaptive levels, typed-vs-choice tracking, words grow/shrink window. Additive only.
ALTER TABLE character_stats ADD COLUMN typed_seen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE character_stats ADD COLUMN typed_correct INTEGER NOT NULL DEFAULT 0;

ALTER TABLE answer_log ADD COLUMN typed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE answer_log ADD COLUMN day TEXT;

ALTER TABLE word_stats ADD COLUMN typed_seen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE word_stats ADD COLUMN typed_correct INTEGER NOT NULL DEFAULT 0;

-- Last ~500 word answers; feeds the "last 20 answers" grow/shrink window.
CREATE TABLE word_answer_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  ms INTEGER NOT NULL,
  typed INTEGER NOT NULL DEFAULT 0,
  day TEXT
);
