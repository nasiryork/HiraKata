import React, { useState, useRef, useEffect } from 'react';
import { WORDS } from './data/words.js';
import { WORDS_RULE as R } from './data/plan.js';
import { poolWords, nextBatchAt, mergeWords } from './lib/words.js';
import NextBar from './NextBar.jsx';
import TodayTimer from './TodayTimer.jsx';
import { planFor } from './lib/plan.js';
import { etDay } from './lib/et.js';

const MAX_W = 8;
const START_AVG_MS = 4000;

const MODES = [
  { id: 'jp-en', label: 'Japanese → meaning' },
  { id: 'en-jp', label: 'English → Japanese' },
  { id: 'typed', label: 'Type romaji' },
];

const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

function weightedPick(pool, weights, excludeId) {
  const candidates = pool.length > 1 ? pool.filter((w) => w.id !== excludeId) : pool;
  const total = candidates.reduce((s, w) => s + (weights[w.id] ?? 1), 0);
  let r = Math.random() * total;
  for (const w of candidates) {
    r -= weights[w.id] ?? 1;
    if (r <= 0) return w;
  }
  return candidates[candidates.length - 1];
}

// 4 choices from the same group (topped up from the rest of the pool); no duplicate answers.
function makeChoices(correct, pool, field) {
  const ok = (w) => w.id !== correct.id && w[field] !== correct[field];
  const same = shuffle(pool.filter((w) => ok(w) && w.group === correct.group));
  const rest = shuffle(pool.filter((w) => ok(w) && w.group !== correct.group));
  const out = [];
  for (const w of [...same, ...rest]) {
    if (out.every((o) => o[field] !== w[field])) out.push(w);
    if (out.length === 3) break;
  }
  return shuffle([correct, ...out]);
}

// Lenient romaji compare: ignore case/spaces/hyphens and long-vowel spelling (ou/oo, aa, ...).
const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[\s\-'’.,!?/]/g, '')
    .replace(/ou|oo/g, 'o')
    .replace(/uu/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'e')
    .replace(/ii/g, 'i');

export default function Words({ log, base, showRomaji, setShowRomaji, suggestRomajiOff }) {
  const [mode, setMode] = useState('jp-en');
  const [poolSize, setPoolSize] = useState(R.startPool);
  const [current, setCurrent] = useState(null);
  const [choices, setChoices] = useState([]);
  const [typed, setTyped] = useState('');
  const [picked, setPicked] = useState(null); // { key, correct }
  const [stats, setStats] = useState({ answered: 0, correct: 0 });
  const [known, setKnown] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [loadedTick, setLoadedTick] = useState(0);

  const weights = useRef({});
  const meta = useRef({}); // id -> {seen, correct, avg_ms}
  const knownIds = useRef(new Set());
  const listRef = useRef(WORDS); // public bank + any private extras the API sends
  const poolRef = useRef(poolWords(WORDS, R.startPool));
  const avgTime = useRef(START_AVG_MS);
  const questionStart = useRef(0);
  const loaded = useRef(false);
  const feedbackRef = useRef(null);

  useEffect(() => {
    fetch('/api/words')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        for (const row of Object.values(data.words)) {
          weights.current[row.id] = row.weight;
          meta.current[row.id] = { seen: row.seen, correct: row.correct, avg_ms: row.avg_ms };
          if (row.known) knownIds.current.add(row.id);
        }
        listRef.current = mergeWords(data.extra ?? []);
        poolRef.current = poolWords(listRef.current, data.pool_size);
        setPoolSize(data.pool_size);
        setKnown(knownIds.current.size);
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setLoadedTick((t) => t + 1);
      });
  }, []);

  const modePool = () => (mode === 'typed' ? poolRef.current.filter((w) => w.jp === w.kana) : poolRef.current);

  const nextQuestion = (excludeId) => {
    const pool = modePool();
    if (!pool.length) return;
    const next = weightedPick(pool, weights.current, excludeId);
    setCurrent(next);
    setChoices(mode === 'typed' ? [] : makeChoices(next, poolRef.current, mode === 'jp-en' ? 'en' : 'jp'));
    setTyped('');
    setPicked(null);
    questionStart.current = Date.now();
  };

  // New logged session whenever the mode changes (and once saved weights have loaded).
  // A mid-sitting pool release does not restart the session; it just widens the next picks.
  useEffect(() => {
    if (!loaded.current) return;
    avgTime.current = START_AVG_MS;
    setStats({ answered: 0, correct: 0 });
    log.begin(`words:${mode}`, null);
    nextQuestion(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, loadedTick]);

  useEffect(() => {
    if (picked) feedbackRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [picked]);

  const answer = (isCorrect, key) => {
    if (picked) return;
    const elapsed = Date.now() - questionStart.current;
    const id = current.id;
    const w = weights.current[id] ?? 1;
    let newWeight;
    if (isCorrect) {
      const fast = elapsed < avgTime.current * 0.8;
      const slow = elapsed > avgTime.current * 1.3;
      newWeight = fast ? Math.max(w * 0.6, R.floorWeight) : slow ? Math.min(w * 1.3, MAX_W) : w;
      avgTime.current = avgTime.current * 0.9 + elapsed * 0.1;
    } else {
      newWeight = Math.min(w * 2, MAX_W);
    }
    weights.current[id] = newWeight;
    const prev = meta.current[id] ?? { seen: 0, correct: 0, avg_ms: null };
    const m = {
      seen: prev.seen + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
      avg_ms: Math.round(prev.avg_ms == null ? elapsed : prev.avg_ms * 0.7 + elapsed * 0.3),
    };
    meta.current[id] = m;

    fetch('/api/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ id, weight: newWeight, ...m, ms: elapsed, isCorrect }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!res) return;
        if (res.known_word) knownIds.current.add(id);
        setKnown(res.known);
        if (res.pool_size !== poolRef.current.length) {
          poolRef.current = poolWords(listRef.current, res.pool_size);
          setPoolSize(res.pool_size);
        }
      })
      .catch(() => {}); // dev mode without functions: nothing persists

    log.record(isCorrect, elapsed);
    setStats((s) => ({ answered: s.answered + 1, correct: s.correct + (isCorrect ? 1 : 0) }));
    setPicked({ key, correct: isCorrect });
  };

  const submitTyped = (e) => {
    e.preventDefault();
    if (picked || !typed.trim()) return;
    const ok = norm(typed) === norm(current.romaji);
    answer(ok, typed);
  };

  if (mode === 'typed' && !modePool().length) {
    return <div className="bg-white rounded-2xl shadow-xl p-8 text-center text-gray-600">No kana-only words in the pool yet.</div>;
  }
  // A mode switch renders once with the previous mode's question; skip it.
  if (!current || (mode === 'typed') !== (choices.length === 0)) return null;

  const hasKanji = current.jp !== current.kana;
  const choiceField = mode === 'jp-en' ? 'en' : 'jp';
  const correctKey = mode === 'typed' ? null : current.id;

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-xl p-4 mb-4 flex flex-wrap gap-2 items-center justify-center">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`py-3 px-4 rounded-lg text-sm font-medium ${mode === m.id ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            {m.label}
          </button>
        ))}
        <label className="flex items-center gap-2 text-sm text-gray-700 py-2 px-2">
          <input type="checkbox" className="w-5 h-5" checked={showRomaji} onChange={(e) => setShowRomaji(e.target.checked)} />
          Romaji
        </label>
      </div>

      {suggestRomajiOff && showRomaji && !dismissed && (
        <div className="bg-green-50 border border-green-300 text-green-800 rounded-xl p-3 mb-4 text-sm flex items-center justify-between gap-3">
          <span>Your hiragana gate passed. Try turning romaji off.</span>
          <span className="flex gap-2 shrink-0">
            <button className="py-2 px-3 bg-green-600 text-white rounded-lg" onClick={() => setShowRomaji(false)}>Turn off</button>
            <button className="py-2 px-3 bg-white border border-green-300 rounded-lg" onClick={() => setDismissed(true)}>Not now</button>
          </span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
        <TodayTimer log={log} type="words" base={base} goalMinutes={planFor(etDay()).entry.words?.minutes ?? 5} />
        <div className="flex justify-between text-sm text-gray-500 mb-3">
          <span>
            {stats.correct}/{stats.answered} correct
          </span>
          <span>
            Pool {poolSize}
            {known != null ? ` · known ${known}` : ''}
            {poolSize < listRef.current.length && known != null ? ` (next batch at ${nextBatchAt(poolSize)})` : ''}
          </span>
        </div>
        <div className="inline-block text-xs font-medium text-purple-700 bg-purple-100 rounded-full px-3 py-1 mb-4">{current.group}</div>

        {mode === 'en-jp' ? (
          <div className="text-3xl font-bold text-gray-800 mb-6">{current.en}</div>
        ) : (
          <div className="mb-6">
            <div className="text-6xl font-bold text-gray-800">{current.jp}</div>
            {hasKanji && <div className="text-xl text-gray-600 mt-2">{current.kana}</div>}
            {showRomaji && mode !== 'typed' && <div className="text-gray-500 mt-1">{current.romaji}</div>}
          </div>
        )}

        {mode === 'typed' ? (
          <form onSubmit={submitTyped} className="flex gap-3 justify-center">
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={!!picked}
              autoCapitalize="none"
              autoCorrect="off"
              className={`p-3 border-2 rounded-lg text-lg text-center w-48 ${
                picked ? (picked.correct ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : 'border-gray-300'
              }`}
              placeholder="romaji"
            />
            {!picked && (
              <button type="submit" className="py-3 px-6 bg-purple-600 text-white font-bold rounded-lg">
                Check
              </button>
            )}
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {choices.map((c) => {
              const isAnswer = picked && c.id === correctKey;
              const isWrongPick = picked && !picked.correct && picked.key === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => answer(c.id === correctKey, c.id)}
                  disabled={!!picked}
                  className={`min-h-[64px] py-3 px-4 rounded-xl font-medium border-2 text-gray-800 ${
                    isAnswer ? 'bg-green-100 border-green-500' : isWrongPick ? 'bg-red-50 border-red-300' : 'border-gray-200 bg-white'
                  }`}
                >
                  {choiceField === 'en' ? (
                    <span className="text-lg">{c.en}</span>
                  ) : (
                    <>
                      <span className="text-2xl">{c.jp}</span>
                      {c.jp !== c.kana && <span className="block text-sm text-gray-600">{c.kana}</span>}
                      {showRomaji && <span className="block text-sm text-gray-500">{c.romaji}</span>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {picked && (
          <>
            <div ref={feedbackRef} style={{ scrollMarginBottom: 110 }} className="mt-4 bg-purple-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-gray-800">{current.jp}</div>
              {hasKanji && <div className="text-gray-700">{current.kana}</div>}
              <div className="text-gray-500">{current.romaji}</div>
              <div className="text-gray-700 mt-1">{current.en}</div>
            </div>
          </>
        )}
      </div>
      <NextBar enabled={!!picked} onNext={() => picked && nextQuestion(current.id)} />
    </div>
  );
}
