import React, { useState, useMemo, useRef, useEffect } from 'react';
import NextBar from './NextBar.jsx';
import TodayProgress from './TodayProgress.jsx';
import TypedShell, { dropKeyboard } from './TypedShell.jsx';
import ModeSwitch from './ModeSwitch.jsx';
import { ADAPT } from './data/plan.js';
import { KANA_PRESETS, goals, planFor } from './lib/plan.js';
import { etDay } from './lib/et.js';
import { ALL_KANA, levelChars, unlockedKeys, pickDistractors, canReverse, extraSpelling } from './lib/kana.js';
import { sameRomaji } from './lib/romaji.js';
import { nextWeight, typedChance } from './lib/weight.js';
import { accColor } from './lib/color.js';

const MIN_W = 0.3;
const START_AVG_MS = 4000;

const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

function weightedPick(pool, weights, excludeChar) {
  const candidates = pool.length > 1 ? pool.filter((k) => k.char !== excludeChar) : pool;
  const wt = (k) => (weights[k.char] ?? 1) * (k.bg ? ADAPT.backgroundWeight : 1);
  const total = candidates.reduce((sum, k) => sum + wt(k), 0);
  let r = Math.random() * total;
  for (const k of candidates) {
    r -= wt(k);
    if (r <= 0) return k;
  }
  return candidates[candidates.length - 1];
}

const Score = ({ stats }) => (
  <span>
    <span className="font-medium" style={stats.answered ? { color: accColor(stats.correct / stats.answered) } : undefined}>
      {stats.correct}/{stats.answered}
    </span>{' '}
    correct · streak {stats.streak}
  </span>
);

export default function Kana({ log, base, preset, setPreset, autoBg, level, dakutenK, mode, setMode, onHome }) {
  const [script, setScript] = useState('hiragana');
  const [category, setCategory] = useState('basic');

  const pool = useMemo(() => {
    if (preset === 'custom') {
      return ALL_KANA.filter((k) => (script === 'both' || k.script === script) && (category === 'all' || k.category === category));
    }
    const main = levelChars(preset, dakutenK).map((k) => ({ ...k }));
    if (!autoBg) return main;
    const have = new Set(main.map((k) => k.char));
    const bg = unlockedKeys(level)
      .flatMap((key) => levelChars(key, dakutenK))
      .filter((k) => !have.has(k.char) && have.add(k.char))
      .map((k) => ({ ...k, bg: true }));
    return [...main, ...bg];
  }, [preset, script, category, autoBg, level, dakutenK]);

  const weights = useRef({});
  const meta = useRef({}); // char -> {seen, correct, avg_ms}, mirrors what's persisted server-side
  const avgTime = useRef(START_AVG_MS);
  const inputRef = useRef(null);

  const [q, setQ] = useState(null); // { k, typed, dir, options }
  const [typedAnswer, setTypedAnswer] = useState('');
  const [result, setResult] = useState(null); // null | 'correct' | 'wrong'
  const [picked, setPicked] = useState(null);
  const questionStart = useRef(0);
  const [loadedTick, setLoadedTick] = useState(0);
  const loaded = useRef(false);
  const [stats, setStats] = useState({ answered: 0, correct: 0, streak: 0 });

  // Load persisted per-character weights once; /api/* is absent under plain `vite dev`.
  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        for (const row of Object.values(data)) {
          weights.current[row.char] = row.weight;
          meta.current[row.char] = { seen: row.seen, correct: row.correct, avg_ms: row.avg_ms };
        }
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setLoadedTick((t) => t + 1);
      });
  }, []);

  const accOf = (ch) => {
    const m = meta.current[ch];
    return m && m.seen >= 3 ? m.correct / m.seen : null;
  };

  // Also runs inside the Next tap/Enter, which is what lets iOS keep (or open) the keyboard.
  const nextQuestion = (excludeChar) => {
    if (!pool.length) return;
    const k = weightedPick(pool, weights.current, excludeChar);
    const m = meta.current[k.char];
    const typed = mode === 'typed' || (mode === 'mix' && Math.random() < typedChance(ADAPT.mix, m?.seen ?? 0, m?.correct ?? 0));
    const dir = !typed && canReverse(k) && Math.random() < ADAPT.mix.reverse ? 's2c' : 'c2s';
    setQ({ k, typed, dir, options: typed ? [] : shuffle([k, ...pickDistractors(k, dir, accOf)]) });
    setTypedAnswer('');
    setResult(null);
    setPicked(null);
    questionStart.current = Date.now();
    if (typed) inputRef.current?.focus({ preventScroll: true });
    else dropKeyboard();
  };

  // Fresh question + session whenever the pool or mode changes. Per-character weights are
  // not reset - they're a property of the character, not the current view.
  useEffect(() => {
    if (!loaded.current) return;
    avgTime.current = START_AVG_MS;
    setStats({ answered: 0, correct: 0, streak: 0 });
    log.begin(`kana:${mode}`, preset === 'custom' ? `custom:${script}/${category}` : preset);
    nextQuestion(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, mode, loadedTick]);

  const grade = (isCorrect) => {
    const { k, typed } = q;
    const elapsed = Date.now() - questionStart.current;
    const w = weights.current[k.char] ?? 1;
    const newWeight = nextWeight({ w, correct: isCorrect, elapsed, avg: avgTime.current, floor: MIN_W, typed });
    if (isCorrect) avgTime.current = avgTime.current * 0.9 + elapsed * 0.1;
    weights.current[k.char] = newWeight;

    const prev = meta.current[k.char] ?? { seen: 0, correct: 0, avg_ms: null };
    const newMeta = {
      seen: prev.seen + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
      avg_ms: Math.round(prev.avg_ms == null ? elapsed : prev.avg_ms * 0.7 + elapsed * 0.3),
    };
    meta.current[k.char] = newMeta;
    fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ script: k.script, char: k.char, weight: newWeight, ...newMeta, ms: elapsed, isCorrect, typed }),
    }).catch(() => {}); // best-effort; dev mode without functions just won't persist

    log.record(isCorrect, elapsed);
    setStats((s) => ({
      answered: s.answered + 1,
      correct: s.correct + (isCorrect ? 1 : 0),
      streak: isCorrect ? s.streak + 1 : 0,
    }));
    setResult(isCorrect ? 'correct' : 'wrong');
  };

  const submitChoice = (opt) => {
    if (result) return;
    setPicked(q.dir === 's2c' ? opt.char : opt.romaji);
    grade(q.dir === 's2c' ? opt.char === q.k.char : opt.romaji === q.k.romaji);
  };

  const checkTyped = () => {
    if (result || !typedAnswer.trim()) return;
    const extra = extraSpelling(q.k);
    grade(sameRomaji(typedAnswer, q.k.romaji) || (!!extra && sameRomaji(typedAnswer, extra)));
  };

  // The shell mounts with the first question, after nextQuestion's own focus() had no input yet.
  useEffect(() => {
    if (q?.typed) inputRef.current?.focus({ preventScroll: true });
  }, [q]);

  const goNext = () => result && nextQuestion(q.k.char);

  if (!q) return null;
  const { k } = q;
  const typedNow = q.typed;
  const goal = goals(planFor(etDay()).entry).kana;

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
      <div className="text-sm text-gray-600 mt-2 text-center">
        <Score stats={stats} />
      </div>
      <TodayProgress log={log} type="kana" base={base} goal={goal} />
    </div>
  );

  const typedPrompt = (
    <>
      <div className="text-8xl font-bold text-gray-800">{k.char}</div>
      {result === 'wrong' && <div className="text-red-600 font-medium mt-3">Correct answer: {k.romaji}</div>}
      {result === 'correct' && <div className="text-green-700 font-medium mt-3">✓ {k.romaji}</div>}
    </>
  );

  return (
    <div>
      {!typedNow && (
        <>
          <div className="bg-white rounded-2xl shadow-xl p-4 mb-4 flex flex-wrap gap-3 items-center justify-center">
            <select value={preset} onChange={(e) => setPreset(e.target.value)} className="p-3 border border-gray-300 rounded-lg">
              <option value="custom">Custom</option>
              {Object.entries(KANA_PRESETS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            {preset === 'custom' && (
              <>
                <select value={script} onChange={(e) => setScript(e.target.value)} className="p-3 border border-gray-300 rounded-lg">
                  <option value="hiragana">Hiragana</option>
                  <option value="katakana">Katakana</option>
                  <option value="both">Both</option>
                </select>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="p-3 border border-gray-300 rounded-lg">
                  <option value="basic">Basic</option>
                  <option value="dakuten">Dakuten</option>
                  <option value="combo">Combinations</option>
                  <option value="all">All</option>
                </select>
              </>
            )}
            <ModeSwitch mode={mode} setMode={setMode} />
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
            <TodayProgress log={log} type="kana" base={base} goal={goal} />
            <div className="text-sm text-gray-500 mb-2">
              <Score stats={stats} />
            </div>
            {q.dir === 's2c' ? (
              <>
                <div className="text-xs text-gray-500">Pick the character</div>
                <div className="text-6xl font-bold text-gray-800 mb-6">{k.romaji}</div>
              </>
            ) : (
              <div className="text-8xl font-bold text-gray-800 mb-6">{k.char}</div>
            )}

            <div className={`grid gap-3 ${q.dir === 's2c' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {q.options.map((o) => {
                const isAnswer = result && (q.dir === 's2c' ? o.char === k.char : o.romaji === k.romaji);
                const isChosenWrong = result === 'wrong' && !isAnswer && (q.dir === 's2c' ? o.char : o.romaji) === picked;
                return (
                  <button
                    key={q.dir === 's2c' ? o.char : o.romaji}
                    onClick={() => submitChoice(o)}
                    disabled={!!result}
                    className={`min-h-[64px] py-4 rounded-lg font-medium border-2 ${q.dir === 's2c' ? 'text-4xl' : 'text-lg'} ${
                      isAnswer
                        ? 'bg-green-100 border-green-500 text-green-800'
                        : isChosenWrong
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'border-gray-200'
                    }`}
                  >
                    {q.dir === 's2c' ? o.char : o.romaji}
                  </button>
                );
              })}
            </div>
            {result === 'wrong' && q.dir === 's2c' && <div className="text-red-600 font-medium mt-4">That is {k.char} ({k.romaji})</div>}
          </div>
          <NextBar enabled={!!result} onNext={goNext} />
        </>
      )}

      <TypedShell
        active={typedNow}
        inputRef={inputRef}
        value={typedAnswer}
        onChange={setTypedAnswer}
        answered={!!result}
        correct={result === 'correct'}
        onCheck={checkTyped}
        onNext={goNext}
        header={overlayHeader}
      >
        {typedPrompt}
      </TypedShell>
    </div>
  );
}
