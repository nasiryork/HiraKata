import React, { useState, useRef, useMemo, useEffect } from 'react';
import { PHRASES, FRAME_NOUNS } from './data/phrases.js';
import { planFor } from './lib/plan.js';
import { etDay } from './lib/et.js';
import NextBar from './NextBar.jsx';

const MAX_W = 8;
const MIN_W = 0.3;
const START_AVG_MS = 6000; // phrases are slower to read than a single kana

const MODES = [
  { id: 'en-jp', label: 'English → Japanese' },
  { id: 'jp-en', label: 'Japanese → meaning' },
  { id: 'frame', label: 'Fill the blank' },
];

const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

function weightedPick(pool, weights, excludeId) {
  const candidates = pool.length > 1 ? pool.filter((p) => p.id !== excludeId) : pool;
  const total = candidates.reduce((s, p) => s + (weights[p.id] ?? 1), 0);
  let r = Math.random() * total;
  for (const p of candidates) {
    r -= weights[p.id] ?? 1;
    if (r <= 0) return p;
  }
  return candidates[candidates.length - 1];
}

function makePhraseChoices(correct, released) {
  const sameGroup = shuffle(released.filter((p) => p.id !== correct.id && !p.frame && p.group === correct.group));
  const others = shuffle(released.filter((p) => p.id !== correct.id && !p.frame && p.group !== correct.group));
  return shuffle([correct, ...[...sameGroup, ...others].slice(0, 3)]);
}

function makeNounChoices(correct, group) {
  const nouns = FRAME_NOUNS[group] ?? [];
  return shuffle([correct, ...shuffle(nouns.filter((n) => n.jp !== correct.jp)).slice(0, 3)]);
}

export default function Phrases({ log, showRomaji, setShowRomaji, suggestRomajiOff, onTouch }) {
  const [mode, setMode] = useState('en-jp');
  const [current, setCurrent] = useState(null);
  const [noun, setNoun] = useState(null); // frame drill: the correct noun
  const [choices, setChoices] = useState([]);
  const [picked, setPicked] = useState(null);
  const [said, setSaid] = useState(false);
  const [stats, setStats] = useState({ answered: 0, correct: 0 });
  const [dismissedSuggest, setDismissedSuggest] = useState(false);

  const weights = useRef({});
  const meta = useRef({}); // id -> {seen, correct, said_count, said_days, last_said_day}
  const avgTime = useRef(START_AVG_MS);
  const questionStart = useRef(0);
  const loaded = useRef(false);
  const [loadedTick, setLoadedTick] = useState(0);

  const ceiling = planFor(etDay()).entry.phrases.newTier;
  const released = useMemo(() => PHRASES.filter((p) => p.tier <= ceiling), [ceiling]);
  const pool = useMemo(
    () => (mode === 'frame' ? released.filter((p) => p.frame) : released.filter((p) => !p.frame)),
    [released, mode]
  );
  const hasFrames = released.some((p) => p.frame);

  useEffect(() => {
    fetch('/api/phrases')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          for (const row of Object.values(data)) {
            weights.current[row.id] = row.weight;
            meta.current[row.id] = row;
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setLoadedTick((t) => t + 1);
      });
  }, []);

  const nextQuestion = (excludeId) => {
    if (!pool.length) return;
    const next = weightedPick(pool, weights.current, excludeId);
    setCurrent(next);
    if (mode === 'frame') {
      const nouns = FRAME_NOUNS[next.group] ?? [];
      const n = nouns[Math.floor(Math.random() * nouns.length)];
      setNoun(n);
      setChoices(makeNounChoices(n, next.group));
    } else {
      setNoun(null);
      setChoices(makePhraseChoices(next, released));
    }
    setPicked(null);
    setSaid(false);
    questionStart.current = Date.now();
  };

  // New question + new logged session whenever the mode changes (and once weights load).
  useEffect(() => {
    if (!loaded.current) return;
    avgTime.current = START_AVG_MS;
    setStats({ answered: 0, correct: 0 });
    log.begin(`phrases:${mode}`, null);
    nextQuestion(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, mode, loadedTick]);

  const persist = (id) => {
    const m = meta.current[id];
    fetch('/api/phrases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, weight: weights.current[id] ?? 1, ...m }),
    }).catch(() => {});
  };

  const answer = (isCorrect, key) => {
    if (picked) return;
    const elapsed = Date.now() - questionStart.current;
    const id = current.id;
    const w = weights.current[id] ?? 1;
    let newWeight;
    if (isCorrect) {
      const fast = elapsed < avgTime.current * 0.8;
      const slow = elapsed > avgTime.current * 1.3;
      newWeight = fast ? Math.max(w * 0.6, MIN_W) : slow ? Math.min(w * 1.3, MAX_W) : w;
      avgTime.current = avgTime.current * 0.9 + elapsed * 0.1;
    } else {
      newWeight = Math.min(w * 2, MAX_W);
    }
    weights.current[id] = newWeight;
    const prev = meta.current[id] ?? { seen: 0, correct: 0, said_count: 0, said_days: 0, last_said_day: null };
    meta.current[id] = { ...prev, seen: prev.seen + 1, correct: prev.correct + (isCorrect ? 1 : 0) };
    persist(id);

    log.record(isCorrect, elapsed);
    setStats((s) => ({ answered: s.answered + 1, correct: s.correct + (isCorrect ? 1 : 0) }));
    setPicked({ key, correct: isCorrect });
    onTouch?.();
  };

  const saidItOut = () => {
    if (said || !current) return;
    const id = current.id;
    const day = etDay();
    const prev = meta.current[id] ?? { seen: 0, correct: 0, said_count: 0, said_days: 0, last_said_day: null };
    meta.current[id] = {
      ...prev,
      said_count: prev.said_count + 1,
      said_days: prev.said_days + (prev.last_said_day === day ? 0 : 1),
      last_said_day: day,
    };
    persist(id);
    setSaid(true);
  };

  const sayCount = current ? meta.current[current.id]?.said_count ?? 0 : 0;

  if (!pool.length) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center text-gray-600">
        No phrases released for this mode yet.
      </div>
    );
  }
  // On a mode switch there is one render with the previous mode's question; skip it.
  if (!current || (mode === 'frame') !== !!noun || current.frame !== (mode === 'frame')) return null;

  const fillJp = (jp) => (noun ? jp.replace('___', noun.jp) : jp);
  const fillRomaji = (r) => (noun ? r.replace('___', noun.romaji) : r);
  const fillEn = (en) => (noun ? en.replace('___', noun.en) : en);

  const choiceLabel = (c) => {
    if (mode === 'frame') {
      return (
        <>
          <span className="text-2xl">{c.jp}</span>
          {showRomaji && <span className="block text-sm text-gray-500">{c.romaji}</span>}
        </>
      );
    }
    if (mode === 'en-jp') {
      return (
        <>
          <span className="text-xl">{c.jp}</span>
          {showRomaji && <span className="block text-sm text-gray-500">{c.romaji}</span>}
        </>
      );
    }
    return <span className="text-lg">{c.en}</span>;
  };

  const choiceKey = (c) => (mode === 'frame' ? c.jp : c.id);
  const correctKey = mode === 'frame' ? noun.jp : current.id;

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-xl p-4 mb-4 flex flex-wrap gap-2 items-center justify-center">
        {MODES.filter((m) => m.id !== 'frame' || hasFrames).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`py-3 px-4 rounded-lg text-sm font-medium ${mode === m.id ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            {m.label}
          </button>
        ))}
        <label className="flex items-center gap-2 text-sm text-gray-700 py-2 px-2">
          <input
            type="checkbox"
            className="w-5 h-5"
            checked={showRomaji}
            onChange={(e) => setShowRomaji(e.target.checked)}
          />
          Romaji
        </label>
      </div>

      {suggestRomajiOff && showRomaji && !dismissedSuggest && (
        <div className="bg-green-50 border border-green-300 text-green-800 rounded-xl p-3 mb-4 text-sm flex items-center justify-between gap-3">
          <span>Your hiragana gate passed. Try turning romaji off.</span>
          <span className="flex gap-2 shrink-0">
            <button className="py-2 px-3 bg-green-600 text-white rounded-lg" onClick={() => setShowRomaji(false)}>
              Turn off
            </button>
            <button className="py-2 px-3 bg-white border border-green-300 rounded-lg" onClick={() => setDismissedSuggest(true)}>
              Not now
            </button>
          </span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
        <div className="text-sm text-gray-500 mb-3">
          {stats.correct}/{stats.answered} correct
        </div>

        {mode === 'en-jp' && <div className="text-2xl font-bold text-gray-800 mb-6">{current.en}</div>}
        {mode === 'jp-en' && (
          <div className="mb-6">
            <div className="text-3xl font-bold text-gray-800">{current.jp}</div>
            {showRomaji && <div className="text-gray-500 mt-1">{current.romaji}</div>}
          </div>
        )}
        {mode === 'frame' && (
          <div className="mb-6">
            <div className="text-3xl font-bold text-gray-800">{current.jp}</div>
            {showRomaji && <div className="text-gray-500 mt-1">{current.romaji}</div>}
            <div className="text-lg text-gray-700 mt-3">{fillEn(current.en)}</div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {choices.map((c) => {
            const key = choiceKey(c);
            const isAnswer = picked && key === correctKey;
            const isWrongPick = picked && !picked.correct && picked.key === key;
            return (
              <button
                key={key}
                onClick={() => answer(key === correctKey, key)}
                disabled={!!picked}
                className={`min-h-[64px] py-3 px-4 rounded-xl font-medium border-2 text-gray-800 ${
                  isAnswer
                    ? 'bg-green-100 border-green-500'
                    : isWrongPick
                    ? 'bg-red-50 border-red-300'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {choiceLabel(c)}
              </button>
            );
          })}
        </div>

        {picked && (
          <div className="mt-6">
            <div className="bg-purple-50 rounded-xl p-4 mb-4">
              <div className="text-2xl font-bold text-gray-800">{fillJp(current.jp)}</div>
              <div className="text-gray-500">{fillRomaji(current.romaji)}</div>
              <div className="text-gray-700 mt-1">{fillEn(current.en)}</div>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={saidItOut}
                disabled={said}
                className={`min-h-[56px] py-3 rounded-xl font-bold ${
                  said ? 'bg-green-100 text-green-800' : 'bg-white border-2 border-purple-400 text-purple-700'
                }`}
              >
                {said ? `Said it out loud ✓ (${sayCount}×)` : 'Said it out loud'}
              </button>
            </div>
            <NextBar onNext={() => nextQuestion(current.id)} />
          </div>
        )}
      </div>
    </div>
  );
}
