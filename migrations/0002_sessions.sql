-- Session log, per-character timing, answer window for the kana gate, phrase stats, settings.
CREATE TABLE session_log (
  id INTEGER PRIMARY KEY,   -- client-generated; re-POSTing the same id replaces the row
  day TEXT NOT NULL,        -- America/New_York date
  started_at TEXT NOT NULL,
  mode TEXT NOT NULL,       -- kana:choice | kana:typed | phrases:en-jp | phrases:jp-en | phrases:frame
  preset TEXT,
  questions INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  avg_ms INTEGER NOT NULL DEFAULT 0,
  seconds INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_session_log_day ON session_log (day);

ALTER TABLE character_stats ADD COLUMN avg_ms INTEGER;
ALTER TABLE character_stats ADD COLUMN last_seen TEXT;  -- ET date

-- Last answers, pruned to ~500 rows; feeds the "last 50 answers" kana gate.
CREATE TABLE answer_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  script TEXT NOT NULL,
  char TEXT NOT NULL,
  correct INTEGER NOT NULL,
  ms INTEGER NOT NULL
);

CREATE TABLE phrase_stats (
  id INTEGER PRIMARY KEY,
  weight REAL NOT NULL DEFAULT 1,
  seen INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  said_count INTEGER NOT NULL DEFAULT 0,
  said_days INTEGER NOT NULL DEFAULT 0,
  last_said_day TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
