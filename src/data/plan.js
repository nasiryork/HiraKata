// Weekly plan. Edit it each week and redeploy.
// - weekStart: ET date of week 1.
// - kana.preset: see KANA_PRESETS in src/lib/plan.js.
// - kana.until: "<N> questions at <P>%" - the day's kana line is met by `minutes` OR this.
// - phrases.newTier: phrases with tier <= newTier are in the pool (releases the batch).
export const PLAN = {
  weekStart: '2026-10-12',
  weeks: [
    { week: 1, kana: { preset: 'lookalikes', minutes: 3, until: '20 questions at 90%' }, phrases: { minutes: 5, newTier: 1 } },
  ],
};
