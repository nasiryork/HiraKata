// GET: all character_stats rows, as { "script:char": {weight, seen, correct, avg_ms, last_seen} }
// POST { script, char, weight, seen, correct, avg_ms, ms, isCorrect }: upsert one row + log the answer
import { etDay } from '../../src/lib/et.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT script, char, weight, seen, correct, avg_ms, last_seen FROM character_stats'
  ).all();
  const byKey = {};
  for (const row of results) byKey[`${row.script}:${row.char}`] = row;
  return Response.json(byKey);
}

export async function onRequestPost({ env, request }) {
  const { script, char, weight, seen, correct, avg_ms = null, ms = 0, isCorrect = false } = await request.json();
  const day = etDay();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO character_stats (script, char, weight, seen, correct, avg_ms, last_seen, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (script, char) DO UPDATE SET weight = ?, seen = ?, correct = ?, avg_ms = ?, last_seen = ?, updated_at = datetime('now')`
    ).bind(script, char, weight, seen, correct, avg_ms, day, weight, seen, correct, avg_ms, day),
    env.DB.prepare('INSERT INTO answer_log (script, char, correct, ms) VALUES (?, ?, ?, ?)').bind(
      script,
      char,
      isCorrect ? 1 : 0,
      Math.round(ms)
    ),
    env.DB.prepare('DELETE FROM answer_log WHERE id <= (SELECT MAX(id) FROM answer_log) - 500'),
  ]);
  return Response.json({ ok: true });
}
