// Words-track rules shared by the API and the UI. No manual rating, no due dates:
// "known" is a counter over fast-correct days; release is gated on how much of the
// current pool is known.
import { WORDS } from '../data/words.js';
import { WORDS_RULE as R } from '../data/plan.js';
import { daysBetween } from './et.js';

export const isKnown = (row) =>
  !!row && (row.known_day != null || row.fast_days >= R.fastDays || (row.days_seen >= 2 && row.weight <= R.floorWeight + 0.001));

export const poolWords = (poolSize) => WORDS.slice(0, poolSize);

export const knownIn = (poolSize, rowsById) => poolWords(poolSize).filter((w) => isKnown(rowsById.get?.(w.id) ?? rowsById[w.id])).length;

// Known count at which the next batch releases.
export const nextBatchAt = (poolSize) => Math.ceil(R.knownPct * poolSize);

export function shouldRelease(poolSize, known, since, day) {
  if (poolSize >= WORDS.length) return false;
  const share = known / poolSize;
  return share >= R.knownPct || (daysBetween(since, day) >= R.stallDays && share >= R.stallPct);
}

// --- server-side (D1) ---

export async function getPoolState(db, day) {
  const { results } = await db.prepare("SELECT key, value FROM settings WHERE key IN ('words_pool_size', 'words_pool_since')").all();
  const s = Object.fromEntries(results.map((r) => [r.key, r.value]));
  if (s.words_pool_size == null) {
    await db
      .batch([
        db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('words_pool_size', ?)").bind(String(R.startPool)),
        db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('words_pool_since', ?)").bind(day),
      ]);
    return { size: R.startPool, since: day };
  }
  return { size: Number(s.words_pool_size), since: s.words_pool_since ?? day };
}

export async function wordRows(db) {
  const { results } = await db
    .prepare('SELECT id, weight, seen, correct, avg_ms, fast_days, days_seen, last_seen_day, known_day FROM word_stats')
    .all();
  return new Map(results.map((r) => [r.id, r]));
}

// Releases at most one batch (never more than R.release words at once). Returns the pool state.
export async function evaluateRelease(db, day) {
  const pool = await getPoolState(db, day);
  const known = knownIn(pool.size, await wordRows(db));
  if (!shouldRelease(pool.size, known, pool.since, day)) return { ...pool, known, released: false };
  const size = Math.min(WORDS.length, pool.size + R.release);
  await db.batch([
    db.prepare("INSERT INTO settings (key, value) VALUES ('words_pool_size', ?) ON CONFLICT (key) DO UPDATE SET value = ?").bind(String(size), String(size)),
    db.prepare("INSERT INTO settings (key, value) VALUES ('words_pool_since', ?) ON CONFLICT (key) DO UPDATE SET value = ?").bind(day, day),
  ]);
  return { size, since: day, known: knownIn(size, await wordRows(db)), released: true };
}
