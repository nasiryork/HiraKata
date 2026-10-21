// GET: { pool_size, next_batch_at, words: { id: row + known } }
// POST { id, weight, seen, correct, avg_ms, ms, isCorrect }: upsert one word, update the
// day counters behind "known", and release the next batch if the rule is met.
import { etDay } from '../../src/lib/et.js';
import { WORDS_RULE as R } from '../../src/data/plan.js';
import { evaluateRelease, getPoolState, isKnown, nextBatchAt, wordRows } from '../../src/lib/words.js';

export async function onRequestGet({ env }) {
  const day = etDay();
  const [pool, rows] = await Promise.all([getPoolState(env.DB, day), wordRows(env.DB)]);
  const words = {};
  for (const [id, row] of rows) words[id] = { ...row, known: isKnown(row) };
  return Response.json({ pool_size: pool.size, next_batch_at: nextBatchAt(pool.size), words });
}

export async function onRequestPost({ env, request }) {
  const { id, weight, seen, correct, avg_ms = null, ms = 0, isCorrect = false } = await request.json();
  const day = etDay();
  const prev = await env.DB.prepare('SELECT * FROM word_stats WHERE id = ?').bind(id).first();

  const fastToday = isCorrect && ms < R.fastMs && prev?.last_fast_day !== day;
  const row = {
    fast_days: (prev?.fast_days ?? 0) + (fastToday ? 1 : 0),
    last_fast_day: fastToday ? day : prev?.last_fast_day ?? null,
    days_seen: (prev?.days_seen ?? 0) + (prev?.last_seen_day === day ? 0 : 1),
    known_day: prev?.known_day ?? null,
  };
  if (!row.known_day && isKnown({ ...row, weight })) row.known_day = day;

  await env.DB.prepare(
    `INSERT INTO word_stats (id, weight, seen, correct, avg_ms, fast_days, last_fast_day, days_seen, last_seen_day, known_day, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (id) DO UPDATE SET weight = ?, seen = ?, correct = ?, avg_ms = ?, fast_days = ?, last_fast_day = ?,
       days_seen = ?, last_seen_day = ?, known_day = ?, updated_at = datetime('now')`
  )
    .bind(
      id, weight, seen, correct, avg_ms, row.fast_days, row.last_fast_day, row.days_seen, day, row.known_day,
      weight, seen, correct, avg_ms, row.fast_days, row.last_fast_day, row.days_seen, day, row.known_day
    )
    .run();

  const pool = await evaluateRelease(env.DB, day);
  return Response.json({ pool_size: pool.size, known: pool.known, released: pool.released, known_word: !!row.known_day });
}
