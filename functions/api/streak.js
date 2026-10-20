// GET: current job streak. Read-only - the streak is bumped when the day's job is
// completed (see /api/session), not on app open.
import { etDay } from '../../src/lib/et.js';
import { streakInfo } from '../../src/lib/summary.js';

export async function onRequestGet({ env }) {
  return Response.json(await streakInfo(env.DB, etDay()));
}
