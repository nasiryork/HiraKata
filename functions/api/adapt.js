// POST { action }: eval (session-end grow/shrink check) | words_grow | words_snooze | words_undo |
// dakuten_grow | dakuten_snooze | level_up. Each action re-checks its own rule server-side, so a
// stale card can never push the pool past the caps in plan.js.
import { etDay } from '../../src/lib/et.js';
import { applyAction } from '../../src/lib/adapt.js';

const ACTIONS = ['eval', 'words_grow', 'words_snooze', 'words_undo', 'dakuten_grow', 'dakuten_snooze', 'level_up'];

export async function onRequestPost({ env, request }) {
  const { action } = await request.json();
  if (!ACTIONS.includes(action)) return new Response('Unknown action', { status: 400 });
  await applyAction(env.DB, etDay(), action);
  return Response.json({ ok: true });
}
