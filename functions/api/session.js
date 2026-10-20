// POST { id, started_at, mode, preset, questions, correct, avg_ms, seconds }: upsert one session
// (same id replaces, so the client can flush repeatedly). Then settles today's job/streak.
import { etDay } from '../../src/lib/et.js';
import { settleJob } from '../../src/lib/summary.js';

export async function onRequestPost({ env, request }) {
  const s = await request.json();
  const day = etDay(new Date(s.started_at));
  await env.DB.prepare(
    `INSERT INTO session_log (id, day, started_at, mode, preset, questions, correct, avg_ms, seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET questions = ?, correct = ?, avg_ms = ?, seconds = ?`
  )
    .bind(s.id, day, s.started_at, s.mode, s.preset ?? null, s.questions, s.correct, s.avg_ms, s.seconds, s.questions, s.correct, s.avg_ms, s.seconds)
    .run();
  return Response.json(await settleJob(env.DB, etDay()));
}
