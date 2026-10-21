import { useRef, useEffect, useCallback } from 'react';

const FLUSH_EVERY = 10; // answers
const AUTOSAVE_SECONDS = 15; // also save time spent reading feedback, even with no new answer
const IDLE_MS = 30000; // no tap/key for this long stops the clock

// Tracks one practice session and persists it to /api/session. The same session id is
// re-POSTed on every flush, so the server row is replaced, never duplicated.
//
// Minutes are ACTIVE time: a 1 s clock that only runs while the page is visible and there
// was a tap/key in the last 30 s. That includes time spent reading feedback, so the number
// matches how long you have actually been practising. `totals` is the same clock summed per
// track (kana/words/phrases) for this page load, which the on-screen timer reads.
//
// `onSettled(result)` gets { streak, doneToday, job, saved_at } on success, or { error }.
export function useSessionLog(onSettled) {
  const s = useRef(null);
  const settled = useRef(onSettled);
  settled.current = onSettled;
  const totals = useRef({ kana: 0, words: 0, phrases: 0 });
  const lastActive = useRef(Date.now());

  const flush = useCallback(() => {
    const cur = s.current;
    if (!cur || (cur.questions === cur.sent && cur.seconds === cur.sentSeconds)) return Promise.resolve();
    cur.sent = cur.questions;
    cur.sentSeconds = cur.seconds;
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
        avg_ms: cur.questions ? Math.round(cur.totalMs / cur.questions) : 0,
        seconds: cur.seconds,
      }),
    })
      .then((r) => (r.ok ? r.json() : { error: r.status }))
      .then((res) => {
        if (res.error) {
          // Not saved: resend on the next flush.
          cur.sent = -1;
          cur.sentSeconds = -1;
        }
        settled.current?.(res);
      })
      .catch(() => {}); // dev mode without functions: nothing persists
  }, []);

  // Start a fresh session (mode/preset/pool changed). Flushes the previous one first.
  const begin = useCallback(
    (mode, preset) => {
      flush();
      const now = Date.now();
      lastActive.current = now;
      s.current = {
        id: now * 1000 + Math.floor(Math.random() * 1000),
        started_at: new Date(now).toISOString(),
        mode,
        type: mode.split(':')[0],
        preset: preset ?? null,
        questions: 0,
        correct: 0,
        totalMs: 0,
        seconds: 0,
        sent: 0,
        sentSeconds: 0,
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
      lastActive.current = Date.now();
      if (cur.questions % FLUSH_EVERY === 0) flush();
    },
    [flush]
  );

  // Seconds practised today in this track on this page load (add the server's earlier total).
  const todaySeconds = useCallback((type) => totals.current[type] ?? 0, []);

  useEffect(() => {
    const touch = () => {
      lastActive.current = Date.now();
    };
    let n = 0;
    const timer = setInterval(() => {
      const cur = s.current;
      if (!cur || document.visibilityState !== 'visible' || Date.now() - lastActive.current > IDLE_MS) return;
      cur.seconds += 1;
      if (totals.current[cur.type] != null) totals.current[cur.type] += 1;
      if (++n % AUTOSAVE_SECONDS === 0) flush();
    }, 1000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush(); // closing the phone must not lose it
    };
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  return { begin, record, flush, todaySeconds };
}
