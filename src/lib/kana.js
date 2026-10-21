// Kana pools, the level ladder and look-alike distractors. Shared by the UI and the API.
import { hiragana, katakana } from '../data/kana.js';
import { ADAPT } from '../data/plan.js';

const BANK = { hiragana, katakana };

export const ALL_KANA = ['hiragana', 'katakana'].flatMap((script) =>
  ['basic', 'dakuten', 'combo'].flatMap((category) => BANK[script][category].map((k) => ({ ...k, script, category })))
);
const BY_CHAR = new Map(ALL_KANA.map((k) => [k.char, k]));
export const kanaOf = (char) => BY_CHAR.get(char);

// Dakuten/handakuten arrive five at a time: row by row, hiragana then katakana.
export const DAKUTEN_ORDER = [0, 1, 2, 3, 4].flatMap((r) =>
  ['hiragana', 'katakana'].flatMap((script) =>
    ALL_KANA.filter((k) => k.script === script && k.category === 'dakuten').slice(r * 5, r * 5 + 5)
  )
);

const LOOKALIKE = ['れ', 'ね', 'ぬ', 'め', 'わ', 'シ', 'ツ', 'ソ', 'ン'];

export const LEVELS = [
  { n: 1, key: 'lookalikes', label: 'Look-alikes' },
  { n: 2, key: 'hira-basic', label: 'Hiragana basic' },
  { n: 3, key: 'kata-basic', label: 'Katakana basic' },
  { n: 4, key: 'dakuten', label: 'Dakuten' },
  { n: 5, key: 'combos', label: 'Combos' },
  { n: 6, key: 'all', label: 'Everything mixed' },
];
export const levelByKey = (key) => LEVELS.find((l) => l.key === key);

// Characters of one level (or preset). `dakutenK` limits the dakuten level to the released batches.
export function levelChars(key, dakutenK = DAKUTEN_ORDER.length) {
  switch (key) {
    case 'lookalikes':
      return LOOKALIKE.map(kanaOf);
    case 'hira-basic':
      return ALL_KANA.filter((k) => k.script === 'hiragana' && k.category === 'basic');
    case 'hira-all':
      return ALL_KANA.filter((k) => k.script === 'hiragana');
    case 'kata-basic':
      return ALL_KANA.filter((k) => k.script === 'katakana' && k.category === 'basic');
    case 'dakuten':
      return DAKUTEN_ORDER.slice(0, dakutenK);
    case 'combos':
      return ALL_KANA.filter((k) => k.category === 'combo');
    case 'shitsu':
      return ['シ', 'ツ', 'ソ', 'ン'].map(kanaOf);
    default:
      return ALL_KANA;
  }
}

// Level keys that are unlocked at `level` (1..6); 'all' only at level 6.
export const unlockedKeys = (level) => LEVELS.filter((l) => l.n <= Math.min(level, 5)).map((l) => l.key);

// --- multiple choice ---

const LOOK_GROUPS = ['れねわぬめ', 'シツソン', 'はほ', 'さち', 'アマ', 'クケタ', 'ノメ', 'るろ', 'ソリ', 'ウフ', 'いり'];
const groupsOf = (ch) => LOOK_GROUPS.filter((g) => g.includes(ch));
const consonant = (k) => k.romaji.slice(0, -1);
const vowel = (k) => k.romaji.slice(-1);

// How tempting `b` is as a wrong answer for `a`: known look-alikes, then same-row / same-vowel
// neighbours, plus a boost for characters he is already shaky on. A little noise keeps it varied.
function confusion(a, b, accOf) {
  let s = Math.random();
  if (groupsOf(a.char).some((g) => g.includes(b.char))) s += 3;
  if (consonant(a) && consonant(a) === consonant(b)) s += 1.5;
  if (vowel(a) === vowel(b)) s += 1;
  const acc = accOf(b.char);
  if (acc != null && acc < 0.85) s += 3 * (0.85 - acc) + 1;
  return s;
}

// `n` wrong options from the same script and category as `correct`. dir 'c2s' compares sounds
// (options are distinct romaji), 's2c' compares characters (options never share the answer's sound).
export function pickDistractors(correct, dir, accOf = () => null, n = 5) {
  const out = [];
  const seen = new Set([dir === 'c2s' ? correct.romaji : correct.char]);
  const ranked = ALL_KANA.filter((k) => k.script === correct.script && k.category === correct.category && k.char !== correct.char)
    .filter((k) => dir === 'c2s' || k.romaji !== correct.romaji)
    .map((k) => ({ k, s: confusion(correct, k, accOf) }))
    .sort((x, y) => y.s - x.s);
  for (const { k } of ranked) {
    const key = dir === 'c2s' ? k.romaji : k.char;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
    if (out.length === n) break;
  }
  return out;
}

// Sound -> character is only unambiguous when no other character in the bucket shares the sound.
export const canReverse = (k) =>
  ALL_KANA.filter((x) => x.script === k.script && x.category === k.category && x.romaji === k.romaji).length === 1;

// Accepted typed spellings beyond the stored romaji (ぢ/づ are typed di/du on a keyboard).
export const extraSpelling = (k) => ({ ぢ: 'di', づ: 'du', ヂ: 'di', ヅ: 'du' })[k.char];

// --- level progress (works on answer rows newest first: {char, correct, ms, typed, day}) ---

export function windowStats(rows, key, dakutenK, n) {
  const set = key === 'all' ? null : new Set(levelChars(key, dakutenK).map((k) => k.char));
  const w = [];
  for (const r of rows) {
    if (!set || set.has(r.char)) {
      w.push(r);
      if (w.length === n) break;
    }
  }
  const c = w.reduce((s, r) => s + r.correct, 0);
  return {
    n: w.length,
    acc: w.length ? c / w.length : null,
    avg_ms: w.length ? Math.round(w.reduce((s, r) => s + r.ms, 0) / w.length) : null,
    typed: w.filter((r) => r.typed).length,
    days: new Set(w.map((r) => r.day ?? 'earlier')).size,
  };
}

export function levelMet(level, st) {
  const need = ADAPT.levelNeed[level];
  return (
    st.n >= need.n &&
    st.acc >= need.acc &&
    (!need.ms || st.avg_ms < need.ms) &&
    (!need.days || st.days >= need.days) &&
    (!need.typed || st.typed >= ADAPT.minTyped)
  );
}

export function needText(level) {
  const need = ADAPT.levelNeed[level];
  return `${Math.round(need.acc * 100)}% over ${need.n}${need.ms ? ` under ${need.ms / 1000}s` : ''}${need.days ? `, ${need.days} days` : ''}${need.typed ? ', some typed' : ''}`;
}

// --- the two Kana dropdowns: which set (left) and which kind (right) ---

export const SETS = [
  { id: 'hiragana', label: 'Hiragana' },
  { id: 'katakana', label: 'Katakana' },
  { id: 'both', label: 'H+K' },
  { id: 'lookalikes', label: 'Look-alikes' },
  { id: 'weak', label: 'Custom (weak spots)' },
];
export const KINDS = [
  { id: 'basic', label: 'Basic' },
  { id: 'dakuten', label: 'Dakuten' },
  { id: 'handakuten', label: 'Handakuten' },
  { id: 'combo', label: 'Combos' },
  { id: 'all', label: 'All' },
];
export const kindIgnored = (set) => set === 'lookalikes' || set === 'weak';

const isHandakuten = (k) => k.category === 'dakuten' && k.romaji.startsWith('p');
const inKind = (k, kind) =>
  kind === 'all' ||
  (kind === 'handakuten' ? isHandakuten(k) : kind === 'dakuten' ? k.category === 'dakuten' && !isHandakuten(k) : k.category === kind);

export function setPool(set, kind, weakChars = []) {
  if (set === 'lookalikes') return levelChars('lookalikes');
  if (set === 'weak') return weakChars.length ? weakChars : levelChars('lookalikes');
  return ALL_KANA.filter((k) => (set === 'both' || k.script === set) && inKind(k, kind));
}

// His ~12 weakest characters (seen >= 3): lowest accuracy first, then slowest. `meta` is char -> {seen, correct, avg_ms}.
export function weakChars(meta, n = 12) {
  return Object.entries(meta)
    .filter(([, m]) => m.seen >= 3)
    .sort(([, a], [, b]) => a.correct / a.seen - b.correct / b.seen || (b.avg_ms ?? 0) - (a.avg_ms ?? 0))
    .map(([ch]) => kanaOf(ch))
    .filter(Boolean)
    .slice(0, n);
}

// Map the app's suggested level/preset onto the two dropdowns.
const SUGGEST = {
  lookalikes: ['lookalikes', 'all'],
  shitsu: ['lookalikes', 'all'],
  'hira-basic': ['hiragana', 'basic'],
  'hira-all': ['hiragana', 'all'],
  'kata-basic': ['katakana', 'basic'],
  dakuten: ['both', 'dakuten'],
  combos: ['both', 'combo'],
  all: ['both', 'all'],
};
export function suggestionFor(preset) {
  const [set, kind] = SUGGEST[preset] ?? ['both', 'all'];
  const sl = SETS.find((s) => s.id === set).label;
  return { set, kind, label: kindIgnored(set) ? sl : `${sl}, ${KINDS.find((x) => x.id === kind).label}` };
}
