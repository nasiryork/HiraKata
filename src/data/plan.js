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
      kana: { preset: 'lookalikes', correct: 20 },
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
