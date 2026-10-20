// Guards every /api route with a shared secret so progress data is not public.
// Set it with: wrangler pages secret put API_SECRET --project-name hirakata
// With no API_SECRET set (local dev, a fresh fork) the API stays open.
export async function onRequest({ request, env, next }) {
  if (env.API_SECRET && request.headers.get('x-hirakata-key') !== env.API_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  return next();
}
