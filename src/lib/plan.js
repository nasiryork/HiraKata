import { PLAN } from '../data/plan.js';
import { daysBetween, addDays } from './et.js';

export const KANA_PRESETS = {
  lookalikes: 'Look-alikes',
  shitsu: 'Shi / Tsu / So / N',
  'hira-basic': 'Basic hiragana',
  'hira-all': 'All hiragana',
  'kata-basic': 'Basic katakana',
  dakuten: 'Dakuten',
  combos: 'Combos',
  all: 'Everything',
};

export const GATE = { accuracy: 0.95, avgMs: 2000, window: 50 };
export const WEAK = { minSeen: 5, accuracy: 0.85 };

export function planFor(day) {
  const week = Math.max(1, Math.floor(daysBetween(PLAN.weekStart, day) / 7) + 1);
  const entry =
    [...PLAN.weeks].filter((e) => e.week <= week).sort((a, b) => b.week - a.week)[0] ?? PLAN.weeks[0];
  return { week, weekFrom: addDays(PLAN.weekStart, 7 * (week - 1)), entry };
}

// Correct answers needed today, per track.
export const goals = (entry) => ({
  kana: entry.kana.correct ?? 20,
  words: entry.words?.correct ?? 15,
  phrases: entry.phrases?.correct ?? 15,
});

// agg = { kana, words, phrases }, each {seconds, questions, correct} for one ET day.
// A line is met when today's CORRECT answers (summed across sittings) reach the goal; there is
// no clock, so leaving the app open earns nothing. The second line is Words, or Phrases when
// the phrases track is switched back on.
export function jobStatus(entry, agg) {
  const g = goals(entry);
  const kana = agg.kana.correct >= g.kana;
  const words = agg.words.correct >= g.words;
  const phrases = agg.phrases.correct >= g.phrases;
  const second = PLAN.phrasesOn ? phrases : words;
  return { kana, words, phrases, second, done: kana && second };
}

// The kana job is picked by the app from his weakest level unless plan.js names a preset.
export const isAuto = (entry) => !entry.kana.preset || entry.kana.preset === 'auto';

export function bannerText(entry, auto) {
  const g = goals(entry);
  const label = isAuto(entry) ? auto?.label ?? 'Kana (auto)' : KANA_PRESETS[entry.kana.preset] ?? entry.kana.preset;
  return {
    kana: `${label}, ${g.kana} correct`,
    second: PLAN.phrasesOn ? `Phrases, ${g.phrases} correct` : `Words, ${g.words} correct`,
  };
}
