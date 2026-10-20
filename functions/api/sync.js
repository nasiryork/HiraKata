// POST: record a "Sync now" timestamp; returns the export so the client can copy it.
import { buildSummary } from '../../src/lib/summary.js';

export async function onRequestPost({ env }) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('last_sync', ?) ON CONFLICT (key) DO UPDATE SET value = ?"
  )
    .bind(now, now)
    .run();
  return Response.json(await buildSummary(env.DB), { headers: { 'Cache-Control': 'no-store' } });
}
