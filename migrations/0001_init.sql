CREATE TABLE character_stats (
  script TEXT NOT NULL,
  char TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1,
  seen INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (script, char)
);

CREATE TABLE daily_streak (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_date TEXT NOT NULL,
  streak INTEGER NOT NULL DEFAULT 1
);
