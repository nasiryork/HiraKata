// GET: all phrase_stats rows as { id: {...} }
// POST { id, weight, seen, correct, said_count, said_days, last_said_day }: upsert one row
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id, weight, seen, correct, said_count, said_days, last_said_day FROM phrase_stats'
  ).all();
  const byId = {};
  for (const row of results) byId[row.id] = row;
  return Response.json(byId);
}

export async function onRequestPost({ env, request }) {
  const p = await request.json();
  const last = p.last_said_day ?? null;
  await env.DB.prepare(
    `INSERT INTO phrase_stats (id, weight, seen, correct, said_count, said_days, last_said_day, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (id) DO UPDATE SET weight = ?, seen = ?, correct = ?, said_count = ?, said_days = ?, last_said_day = ?, updated_at = datetime('now')`
  )
    .bind(p.id, p.weight, p.seen, p.correct, p.said_count, p.said_days, last,
          p.weight, p.seen, p.correct, p.said_count, p.said_days, last)
    .run();
  return Response.json({ ok: true });
}
