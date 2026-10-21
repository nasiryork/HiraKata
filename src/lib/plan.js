import { PLAN } from '../data/plan.js';
import { daysBetween, addDays } from './et.js';

export const KANA_PRESETS = {
  lookalikes: 'Look-alikes',
  shitsu: 'Shi / Tsu / So / N',
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

export function parseUntil(until) {
  const m = /(\d+)\s*questions?.*?(\d+)\s*%/i.exec(until ?? '');
  return m ? { questions: Number(m[1]), pct: Number(m[2]) } : { questions: 20, pct: 90 };
}

// agg = { kana, words, phrases } each {seconds, questions, correct} for one ET day.
// The second job line is Words, or Phrases when the phrases track is switched back on.
export function jobStatus(entry, agg) {
  const u = parseUntil(entry.kana.until);
  const k = agg.kana;
  const kana =
    k.seconds >= entry.kana.minutes * 60 ||
    (k.questions >= u.questions && k.correct / k.questions >= u.pct / 100);
  const words = agg.words.seconds >= (entry.words?.minutes ?? 5) * 60;
  const phrases = agg.phrases.seconds >= (entry.phrases?.minutes ?? 5) * 60;
  const second = PLAN.phrasesOn ? phrases : words;
  return { kana, words, phrases, second, done: kana && second };
}

export function bannerText(entry) {
  const u = parseUntil(entry.kana.until);
  const label = KANA_PRESETS[entry.kana.preset] ?? entry.kana.preset;
  return {
    kana: `${label}, ${entry.kana.minutes} min or ${u.questions} right at ${u.pct}%`,
    second: PLAN.phrasesOn
      ? `Phrases, ${entry.phrases?.minutes ?? 5} min`
      : `Words, ${entry.words?.minutes ?? 5} min`,
  };
}
