// GET: all settings as { key: value }.  POST { key, value }: upsert one.
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  return Response.json(Object.fromEntries(results.map((r) => [r.key, r.value])));
}

export async function onRequestPost({ env, request }) {
  const { key, value } = await request.json();
  await env.DB.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = ?'
  )
    .bind(key, String(value), String(value))
    .run();
  return Response.json({ ok: true });
}
