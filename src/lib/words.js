// Words-track rules shared by the API and the UI. No manual rating, no due dates:
// "known" is a counter over fast-correct days; release is gated on how much of the
// current pool is known.
import { WORDS } from '../data/words.js';
import { WORDS_RULE as R } from '../data/plan.js';
import { daysBetween } from './et.js';

export const isKnown = (row) =>
  !!row && (row.known_day != null || row.fast_days >= R.fastDays || (row.days_seen >= 2 && row.weight <= R.floorWeight + 0.001));

// The public bank (src/data/words.js) plus any private extras from the `extra_words` table.
// Extras are placed by `after_id` (they slot in right after that public word); the public
// repo ships none, so a fork or a fresh database just gets the regular bank.
export function mergeWords(extras = []) {
  if (!extras.length) return WORDS;
  const rank = (w, i) => (w.after_id != null ? w.after_id + 0.5 + i / 1000 : w.id);
  return [...WORDS, ...extras.map((e, i) => ({ ...e, group: e.group ?? e.group_name, _x: rank(e, i) }))]
    .map((w) => ({ ...w, _r: w._x ?? w.id }))
    .sort((a, b) => a._r - b._r);
}

export const poolWords = (list, poolSize) => list.slice(0, poolSize);

// Active pool = first N by id, minus words resting after an automatic shrink. Resting words keep
// their stats and come back first.
export const activeWords = (list, poolSize, resting = []) => {
  const rest = new Set(resting);
  return list.slice(0, poolSize).filter((w) => !rest.has(w.id));
};

export const knownIn = (list, poolSize, rowsById, resting = []) =>
  activeWords(list, poolSize, resting).filter((w) => isKnown(rowsById.get(w.id))).length;

// Known count at which the next batch releases.
export const nextBatchAt = (poolSize) => Math.ceil(R.knownPct * poolSize);

export function shouldRelease(poolSize, known, since, day, total, active = poolSize) {
  if (poolSize >= total) return false;
  const share = known / Math.max(1, active);
  return share >= R.knownPct || (daysBetween(since, day) >= R.stallDays && share >= R.stallPct);
}

// --- server-side (D1) ---

export async function loadWordList(db) {
  try {
    const { results } = await db
      .prepare('SELECT id, jp, kana, romaji, en, group_name, after_id FROM extra_words ORDER BY id')
      .all();
    return mergeWords(results);
  } catch {
    return WORDS; // table not migrated yet: regular bank only
  }
}

export async function getPoolState(db, day) {
  const { results } = await db.prepare("SELECT key, value FROM settings WHERE key IN ('words_pool_size', 'words_pool_since', 'words_resting')").all();
  const s = Object.fromEntries(results.map((r) => [r.key, r.value]));
  if (s.words_pool_size == null) {
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('words_pool_size', ?)").bind(String(R.startPool)),
      db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('words_pool_since', ?)").bind(day),
    ]);
    return { size: R.startPool, since: day, resting: [] };
  }
  return { size: Number(s.words_pool_size), since: s.words_pool_since ?? day, resting: parseList(s.words_resting) };
}

export function parseList(v) {
  try {
    const a = JSON.parse(v ?? '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export async function wordRows(db) {
  try {
    const { results } = await db
      .prepare('SELECT id, weight, seen, correct, avg_ms, fast_days, days_seen, last_seen_day, known_day, typed_seen, typed_correct FROM word_stats')
      .all();
    return new Map(results.map((r) => [r.id, r]));
  } catch {
    return new Map(); // 0003_words.sql not applied yet
  }
}

// Releases at most one batch (never more than R.release words at once). Returns the pool state.
// Nothing is released while words are resting: the pool is already struggling.
export async function evaluateRelease(db, day) {
  const [pool, list] = await Promise.all([getPoolState(db, day), loadWordList(db)]);
  const rows = await wordRows(db);
  const known = knownIn(list, pool.size, rows, pool.resting);
  const active = activeWords(list, pool.size, pool.resting).length;
  if (pool.resting.length || !shouldRelease(pool.size, known, pool.since, day, list.length, active)) {
    return { ...pool, known, released: false };
  }
  const size = Math.min(list.length, pool.size + R.release);
  const add = size - pool.size;
  const cur = await db.prepare("SELECT key, value FROM settings WHERE key IN ('words_added_day', 'words_added_n')").all();
  const c = Object.fromEntries(cur.results.map((r) => [r.key, r.value]));
  const addedToday = (c.words_added_day === day ? Number(c.words_added_n) : 0) + add;
  const up = (k, v) =>
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = ?').bind(k, String(v), String(v));
  await db.batch([
    up('words_pool_size', size),
    up('words_pool_since', day),
    up('words_added_day', day),
    up('words_added_n', addedToday),
    up('words_last_event', JSON.stringify({ kind: 'release', day, n: add })),
  ]);
  return { ...pool, size, since: day, known: knownIn(list, size, rows, pool.resting), released: true };
}
