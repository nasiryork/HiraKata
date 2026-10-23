import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { WORDS } from './data/words.js';
import { WORDS_RULE as R, ADAPT } from './data/plan.js';
import { activeWords, nextBatchAt, mergeWords } from './lib/words.js';
import { sameRomaji } from './lib/romaji.js';
import { nextWeight, typedChance } from './lib/weight.js';
import { accColor } from './lib/color.js';
import NextBar from './NextBar.jsx';
import TodayProgress from './TodayProgress.jsx';
import TypedShell, { dropKeyboard } from './TypedShell.jsx';
import ModeSwitch from './ModeSwitch.jsx';
import { planFor, goals } from './lib/plan.js';
import { etDay } from './lib/et.js';

const START_AVG_MS = 4000;
const OPTIONS = 6;

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

// 6 choices from the same group (topped up from the rest of the pool); no duplicate answers.
function makeChoices(correct, pool, field) {
  const ok = (w) => w.id !== correct.id && w[field] !== correct[field];
  const same = shuffle(pool.filter((w) => ok(w) && w.group === correct.group));
  const rest = shuffle(pool.filter((w) => ok(w) && w.group !== correct.group));
  const out = [];
  for (const w of [...same, ...rest]) {
    if (out.every((o) => o[field] !== w[field])) out.push(w);
    if (out.length === OPTIONS - 1) break;
  }
  return shuffle([correct, ...out]);
}

export default function Words({ log, base, showRomaji, setShowRomaji, suggestRomajiOff, mode, setMode, onHome }) {
  const [poolSize, setPoolSize] = useState(R.startPool);
  const [q, setQ] = useState(null); // { w, typed, dir: 'jp-en' | 'en-jp', options }
  const [typed, setTyped] = useState('');
  const [picked, setPicked] = useState(null); // { key, correct }
  const [stats, setStats] = useState({ answered: 0, correct: 0 });
  const [known, setKnown] = useState(null);
  const [resting, setResting] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [loadedTick, setLoadedTick] = useState(0);

  const weights = useRef({});
  const meta = useRef({}); // id -> {seen, correct, avg_ms}
  const knownIds = useRef(new Set());
  const listRef = useRef(WORDS); // public bank + any private extras the API sends
  const poolRef = useRef(activeWords(WORDS, R.startPool));
  const avgTime = useRef(START_AVG_MS);
  const questionStart = useRef(0);
  const loaded = useRef(false);
  const feedbackRef = useRef(null);
  const inputRef = useRef(null);

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
        poolRef.current = activeWords(listRef.current, data.pool_size, data.resting);
        setPoolSize(data.pool_size);
        setResting(data.resting?.length ?? 0);
        setKnown(knownIds.current.size);
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setLoadedTick((t) => t + 1);
      });
  }, []);

  // Also runs inside the Next tap/Enter, which is what lets iOS keep (or open) the keyboard.
  const nextQuestion = (excludeId) => {
    const pool = poolRef.current;
    if (!pool.length) return;
    const w = weightedPick(pool, weights.current, excludeId);
    const m = meta.current[w.id];
    const isTyped = mode === 'typed' || (mode === 'mix' && Math.random() < typedChance(ADAPT.mix, m?.seen ?? 0, m?.correct ?? 0));
    const dir = Math.random() < 0.6 ? 'jp-en' : 'en-jp';
    setQ({ w, typed: isTyped, dir, options: isTyped ? [] : makeChoices(w, pool, dir === 'jp-en' ? 'en' : 'jp') });
    setTyped('');
    setPicked(null);
    questionStart.current = Date.now();
    if (isTyped) {
      // The input is still read-only from the last answer; iOS skips the keyboard for a read-only
      // focus() and then waits seconds. Unlock it now, inside the tap, before focusing.
      if (inputRef.current) inputRef.current.readOnly = false;
      inputRef.current?.focus({ preventScroll: true });
    } else dropKeyboard();
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
    if (picked && !q?.typed) feedbackRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [picked, q]);

  const answer = (isCorrect, key) => {
    if (picked) return;
    const elapsed = Date.now() - questionStart.current;
    const id = q.w.id;
    const isTyped = q.typed;
    const w = weights.current[id] ?? 1;
    const newWeight = nextWeight({ w, correct: isCorrect, elapsed, avg: avgTime.current, floor: R.floorWeight, typed: isTyped });
    if (isCorrect) avgTime.current = avgTime.current * 0.9 + elapsed * 0.1;
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
      body: JSON.stringify({ id, weight: newWeight, ...m, ms: elapsed, isCorrect, typed: isTyped }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!res) return;
        if (res.known_word) knownIds.current.add(id);
        setKnown(res.known);
        if (res.pool_size !== poolSize) {
          poolRef.current = activeWords(listRef.current, res.pool_size, res.resting);
          setPoolSize(res.pool_size);
        }
      })
      .catch(() => {}); // dev mode without functions: nothing persists

    log.record(isCorrect, elapsed);
    setStats((s) => ({ answered: s.answered + 1, correct: s.correct + (isCorrect ? 1 : 0) }));
    setPicked({ key, correct: isCorrect });
  };

  const checkTyped = () => {
    if (picked || !typed.trim()) return;
    answer(sameRomaji(typed, q.w.romaji), typed);
  };

  // The shell mounts with the first question, after nextQuestion's own focus() had no input yet.
  useLayoutEffect(() => {
    if (q?.typed) inputRef.current?.focus({ preventScroll: true });
  }, [q]);

  const goNext = () => picked && nextQuestion(q.w.id);

  if (!q) return poolRef.current.length ? null : <div className="bg-white rounded-2xl shadow-xl p-8 text-center text-gray-600">No words in the pool yet.</div>;

  const { w: current } = q;
  const hasKanji = current.jp !== current.kana;
  const typedNow = q.typed;
  const choiceField = q.dir === 'jp-en' ? 'en' : 'jp';
  const goal = goals(planFor(etDay()).entry).words;

  const score = (
    <span>
      <span className="font-medium" style={stats.answered ? { color: accColor(stats.correct / stats.answered) } : undefined}>
        {stats.correct}/{stats.answered}
      </span>{' '}
      correct
    </span>
  );

  const answerCard = (
    <div ref={feedbackRef} style={{ scrollMarginBottom: 170 }} className="mt-4 bg-purple-50 rounded-xl p-4 w-full">
      <div className="text-2xl font-bold text-gray-800">{current.jp}</div>
      {hasKanji && <div className="text-gray-700">{current.kana}</div>}
      <div className="text-gray-500">{current.romaji}</div>
      <div className="text-gray-700 mt-1">{current.en}</div>
    </div>
  );

  const overlayHeader = (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={onHome}
          className="py-2 px-3 rounded-lg bg-white text-gray-700 text-sm font-medium"
        >
          ← Home
        </button>
        <ModeSwitch mode={mode} setMode={setMode} small />
      </div>
      <div className="text-sm text-gray-600 mt-2 text-center">{score}</div>
      <TodayProgress log={log} type="words" base={base} goal={goal} />
    </div>
  );

  return (
    <div>
      {!typedNow && (
        <>
          <div className="bg-white rounded-2xl shadow-xl p-4 mb-4 flex flex-wrap gap-3 items-center justify-center">
            <ModeSwitch mode={mode} setMode={setMode} />
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
            <TodayProgress log={log} type="words" base={base} goal={goal} />
            <div className="flex justify-between text-sm text-gray-500 mb-3">
              <span>{score}</span>
              <span>
                Pool {poolRef.current.length}
                {resting ? ` (+${resting} resting)` : ''}
                {known != null ? ` · known ${known}` : ''}
                {poolSize < listRef.current.length && known != null && !resting ? ` (next batch at ${nextBatchAt(poolRef.current.length)})` : ''}
              </span>
            </div>
            <div className="inline-block text-xs font-medium text-purple-700 bg-purple-100 rounded-full px-3 py-1 mb-4">{current.group}</div>

            {q.dir === 'en-jp' ? (
              <div className="text-3xl font-bold text-gray-800 mb-6">{current.en}</div>
            ) : (
              <div className="mb-6">
                <div className="text-6xl font-bold text-gray-800">{current.jp}</div>
                {hasKanji && <div className="text-xl text-gray-600 mt-2">{current.kana}</div>}
                {showRomaji && <div className="text-gray-500 mt-1">{current.romaji}</div>}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {q.options.map((c) => {
                const isAnswer = picked && c.id === current.id;
                const isWrongPick = picked && !picked.correct && picked.key === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => answer(c.id === current.id, c.id)}
                    disabled={!!picked}
                    className={`min-h-[60px] py-3 px-4 rounded-xl font-medium border-2 text-gray-800 ${
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

            {picked && answerCard}
          </div>
          <NextBar enabled={!!picked} onNext={goNext} />
        </>
      )}

      <TypedShell
        active={typedNow}
        inputRef={inputRef}
        value={typed}
        onChange={setTyped}
        answered={!!picked}
        correct={!!picked?.correct}
        onCheck={checkTyped}
        onNext={goNext}
        header={overlayHeader}
        feedback={answerCard}
      >
        <div className="text-xs text-gray-500 mb-1">Type the reading in romaji</div>
        <div className="text-6xl font-bold text-gray-800 break-words max-w-full">{current.jp}</div>
        {hasKanji && <div className="text-gray-500 mt-2">{current.en}</div>}
      </TypedShell>
    </div>
  );
}
