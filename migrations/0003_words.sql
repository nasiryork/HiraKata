-- Words track: per-word weight/timing plus the day counters behind the "known" rule.
CREATE TABLE word_stats (
  id INTEGER PRIMARY KEY,             -- words.js id (= release order)
  weight REAL NOT NULL DEFAULT 1,
  seen INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  avg_ms INTEGER,
  fast_days INTEGER NOT NULL DEFAULT 0,  -- distinct ET days with a correct answer under the speed cutoff
  last_fast_day TEXT,
  days_seen INTEGER NOT NULL DEFAULT 0,  -- distinct ET days answered
  last_seen_day TEXT,
  known_day TEXT,                        -- ET day it first met the known rule (latched)
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
