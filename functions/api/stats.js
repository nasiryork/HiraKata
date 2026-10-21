// GET: all character_stats rows, as { "script:char": {weight, seen, correct, avg_ms, last_seen} }
// POST { script, char, weight, seen, correct, avg_ms, ms, isCorrect }: upsert one row + log the answer (typed = 1 when the answer was typed, 0 for multiple choice)
import { etDay } from '../../src/lib/et.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT script, char, weight, seen, correct, avg_ms, last_seen, typed_seen, typed_correct FROM character_stats'
  ).all();
  const byKey = {};
  for (const row of results) byKey[`${row.script}:${row.char}`] = row;
  return Response.json(byKey);
}

export async function onRequestPost({ env, request }) {
  const { script, char, weight, seen, correct, avg_ms = null, ms = 0, isCorrect = false, typed = false } = await request.json();
  const day = etDay();
  const t = typed ? 1 : 0;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO character_stats (script, char, weight, seen, correct, avg_ms, last_seen, typed_seen, typed_correct, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (script, char) DO UPDATE SET weight = ?, seen = ?, correct = ?, avg_ms = ?, last_seen = ?,
         typed_seen = typed_seen + ?, typed_correct = typed_correct + ?, updated_at = datetime('now')`
    ).bind(script, char, weight, seen, correct, avg_ms, day, t, t && isCorrect ? 1 : 0,
           weight, seen, correct, avg_ms, day, t, t && isCorrect ? 1 : 0),
    env.DB.prepare('INSERT INTO answer_log (script, char, correct, ms, typed, day) VALUES (?, ?, ?, ?, ?, ?)').bind(
      script,
      char,
      isCorrect ? 1 : 0,
      Math.round(ms),
      t,
      day
    ),
    env.DB.prepare('DELETE FROM answer_log WHERE id <= (SELECT MAX(id) FROM answer_log) - 3000'),
  ]);
  return Response.json({ ok: true });
}
