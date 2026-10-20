// GET: progress export for a weekly check-in. Everything is already in D1, so this
// needs no action from the user. `text` is the short block; the rest is raw JSON.
import { buildSummary } from '../../src/lib/summary.js';

export async function onRequestGet({ env }) {
  return Response.json(await buildSummary(env.DB), { headers: { 'Cache-Control': 'no-store' } });
}
