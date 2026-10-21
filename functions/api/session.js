// POST { id, started_at, mode, preset, questions, correct, avg_ms, seconds }: upsert one session
// (same id replaces, so the client can flush repeatedly). Then settles today's job/streak and
// stamps last_sync, which the Home "Last saved" line reads.
import { etDay } from '../../src/lib/et.js';
import { settleJob } from '../../src/lib/summary.js';

export async function onRequestPost({ env, request }) {
  const s = await request.json();
  const day = etDay(new Date(s.started_at));
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO session_log (id, day, started_at, mode, preset, questions, correct, avg_ms, seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET questions = ?, correct = ?, avg_ms = ?, seconds = ?`
    ).bind(s.id, day, s.started_at, s.mode, s.preset ?? null, s.questions, s.correct, s.avg_ms, s.seconds, s.questions, s.correct, s.avg_ms, s.seconds),
    env.DB.prepare(
      "INSERT INTO settings (key, value) VALUES ('last_sync', ?) ON CONFLICT (key) DO UPDATE SET value = ?"
    ).bind(now, now),
  ]);
  return Response.json({ ...(await settleJob(env.DB, etDay())), saved_at: now });
}
