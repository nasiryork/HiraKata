// Weekly plan. Edit it each week and redeploy.
// - weekStart: ET date of week 1.
// - phrasesOn: false parks the Phrases track (tab hidden, job uses Words instead). One-line switch back.
// - kana.preset: see KANA_PRESETS in src/lib/plan.js.
// - kana.correct / words.correct: right answers needed today. Counted across all sittings that
//   ET day; no clock involved, so leaving the app open earns nothing.
// - phrases.newTier: phrases with tier <= newTier are in the pool (only used while phrasesOn).
export const PLAN = {
  weekStart: '2026-10-12',
  phrasesOn: false,
  weeks: [
    {
      week: 1,
      kana: { preset: 'auto', correct: 20 }, // 'auto' = the app picks from your weakest level; any other preset name overrides it
      words: { correct: 15 },
      phrases: { correct: 15, newTier: 1 },
    },
  ],
};

// Words release rule (mastery-gated, not calendar-gated). Tuned weekly from /api/export.
export const WORDS_RULE = {
  startPool: 10, // words in the pool at the start (first N by id)
  release: 10, // words added per release; never more than this at once
  knownPct: 0.8, // release when this share of the current pool is known...
  stallDays: 7, // ...or after this many days since the last release...
  stallPct: 0.6, // ...with at least this share known
  fastMs: 4000, // a "fast" correct answer is under this
  fastDays: 3, // known = fast and correct on this many separate days
  floorWeight: 0.3, // ...or weight at this floor after 2+ days seen
  weakMinSeen: 3, // export "weak": seen at least this many times...
  weakAccuracy: 0.85, // ...and under this accuracy
};

// Adaptive rules (tuned weekly from /api/export). Everything here changes the SIZE or MIX of a
// bounded pool from his own answers; there are no due dates and no manual difficulty rating.
export const ADAPT = {
  // Words: "Add 5 words?" card on Home after a session.
  grow: { acc: 0.9, ms: 4000, n: 20, add: 5, maxPerDay: 10 },
  // Words: automatic rest of the newest unlearned words (with Undo). Back above restoreAcc over n answers.
  shrink: { acc: 0.65, n: 20, rest: 5, minPool: 10, restoreAcc: 0.85 },
  // Dakuten/handakuten arrive in batches of 5; same grow/shrink idea on the last 20 dakuten answers.
  dakuten: { start: 5, batch: 5, growAcc: 0.9, shrinkAcc: 0.65, n: 20 },
  // Mix mode: share of typed questions per character (higher once the character is above `above`).
  mix: { typed: 0.15, typedHigh: 0.35, above: 0.85, reverse: 0.3 },
  // Characters from lower levels stay in the mix at this relative weight.
  backgroundWeight: 0.12,
  minTyped: 5, // a gate needs at least this many typed answers in its window
  // Level ladder criteria: accuracy over the last n answers on that level's characters.
  levelNeed: {
    1: { acc: 0.9, n: 20, days: 2 },
    2: { acc: 0.95, n: 50, ms: 2000 },
    3: { acc: 0.95, n: 50, ms: 2500, typed: true },
    4: { acc: 0.9, n: 20 },
    5: { acc: 0.9, n: 20 },
    6: { acc: 0.95, n: 50, ms: 2000, typed: true },
  },
  startLevel: 4, // highest unlocked level when nothing is saved yet (dakuten opens alongside katakana)
};
