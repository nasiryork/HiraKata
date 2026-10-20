import { useRef, useEffect, useCallback } from 'react';

const FLUSH_EVERY = 10;
const MAX_Q_SECONDS = 30; // cap per-question time so a walk-away doesn't inflate minutes

// Tracks one practice session and persists it to /api/session. The same session id is
// re-POSTed on every flush, so the server row is replaced, never duplicated.
// `onSettled(result)` receives { streak, doneToday, job } from the server.
export function useSessionLog(onSettled) {
  const s = useRef(null);
  const settled = useRef(onSettled);
  settled.current = onSettled;

  const flush = useCallback(() => {
    const cur = s.current;
    if (!cur || cur.questions === cur.sent) return Promise.resolve();
    cur.sent = cur.questions;
    return fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        id: cur.id,
        started_at: cur.started_at,
        mode: cur.mode,
        preset: cur.preset,
        questions: cur.questions,
        correct: cur.correct,
        avg_ms: Math.round(cur.totalMs / cur.questions),
        seconds: Math.round(cur.seconds),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => res && settled.current?.(res))
      .catch(() => {}); // dev mode without functions: nothing persists
  }, []);

  // Start a fresh session (mode/preset/pool changed). Flushes the previous one first.
  const begin = useCallback(
    (mode, preset) => {
      flush();
      const now = Date.now();
      s.current = {
        id: now * 1000 + Math.floor(Math.random() * 1000),
        started_at: new Date(now).toISOString(),
        mode,
        preset: preset ?? null,
        questions: 0,
        correct: 0,
        totalMs: 0,
        seconds: 0,
        sent: 0,
      };
    },
    [flush]
  );

  const record = useCallback(
    (isCorrect, ms) => {
      const cur = s.current;
      if (!cur) return;
      cur.questions += 1;
      cur.correct += isCorrect ? 1 : 0;
      cur.totalMs += ms;
      cur.seconds += Math.min(ms / 1000, MAX_Q_SECONDS);
      if (cur.questions % FLUSH_EVERY === 0) flush();
    },
    [flush]
  );

  // Closing the phone / switching apps must not lose the session.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  return { begin, record, flush };
}
