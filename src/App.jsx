import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { hiragana, katakana } from './data/kana.js';
import Phrases from './Phrases.jsx';
import Words from './Words.jsx';
import Stats from './Stats.jsx';
import GateBar from './GateBar.jsx';
import NextBar from './NextBar.jsx';
import TodayProgress from './TodayProgress.jsx';
import { PLAN } from './data/plan.js';
import { useSessionLog } from './lib/useSessionLog.js';
import { KANA_PRESETS, GATE, planFor, bannerText, goals } from './lib/plan.js';
import { etDay } from './lib/et.js';

const MAX_W = 8;
const MIN_W = 0.3;
const START_AVG_MS = 4000;
const ROMAJI_KEY = 'hirakata-show-romaji';

const PRESET_CHARS = {
  lookalikes: ['れ', 'ね', 'ぬ', 'め', 'わ'],
  shitsu: ['シ', 'ツ', 'ソ', 'ン'],
};

function buildPool(script, category) {
  const scripts = script === 'both' ? ['hiragana', 'katakana'] : [script];
  const cats = category === 'all' ? ['basic', 'dakuten', 'combo'] : [category];
  return scripts.flatMap((s) =>
    cats.flatMap((c) => (s === 'hiragana' ? hiragana : katakana)[c].map((k) => ({ ...k, script: s })))
  );
}

// A preset is a bounded subset of the existing kana pool.
function buildPresetPool(preset) {
  if (PRESET_CHARS[preset]) {
    const all = buildPool('both', 'all');
    return PRESET_CHARS[preset].map((ch) => all.find((k) => k.char === ch)).filter(Boolean);
  }
  switch (preset) {
    case 'hira-all':
      return buildPool('hiragana', 'all');
    case 'kata-basic':
      return buildPool('katakana', 'basic');
    case 'dakuten':
      return buildPool('both', 'dakuten');
    case 'combos':
      return buildPool('both', 'combo');
    default:
      return buildPool('both', 'all');
  }
}

function weightedPick(pool, weights, excludeChar) {
  const candidates = pool.length > 1 ? pool.filter((k) => k.char !== excludeChar) : pool;
  const total = candidates.reduce((sum, k) => sum + (weights[k.char] ?? 1), 0);
  let r = Math.random() * total;
  for (const k of candidates) {
    r -= weights[k.char] ?? 1;
    if (r <= 0) return k;
  }
  return candidates[candidates.length - 1];
}

function makeChoices(correct, pool) {
  const distractors = pool
    .filter((k) => k.romaji !== correct.romaji)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  return [correct, ...distractors].sort(() => Math.random() - 0.5);
}

const TabButton = ({ id, tab, setTab, children }) => (
  <button
    onClick={() => setTab(id)}
    className={`flex-1 py-3 rounded-xl font-bold ${tab === id ? 'bg-purple-600 text-white' : 'bg-white text-gray-700'}`}
  >
    {children}
  </button>
);

function Bar({ frac, done }) {
  return (
    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full ${done ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${Math.round(Math.min(1, frac) * 100)}%` }} />
    </div>
  );
}

function Home({ summary, offline, loadError, saveError, onStartKana, onStartSecond, onSave, saving, lastSaved }) {
  const day = etDay();
  const { entry } = planFor(day);
  const banner = bannerText(entry);
  const job = summary?.job ?? { kana: false, second: false, done: false };
  const streak = summary?.streak ?? 0;
  const today = summary?.today ?? { kana: { correct: 0 }, words: { correct: 0 }, phrases: { correct: 0 } };
  const g = goals(entry);
  const secondType = PLAN.phrasesOn ? 'phrases' : 'words';
  const kanaN = today.kana.correct;
  const secondN = today[secondType].correct;
  const check = (ok) => (
    <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-sm shrink-0 ${ok ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
      {ok ? '✓' : ''}
    </span>
  );

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-4 flex items-center gap-4">
        <span className={`text-5xl ${streak > 0 ? '' : 'grayscale opacity-50'}`}>🔥</span>
        <div>
          <div className="text-3xl font-bold text-orange-600">
            {streak} {streak === 1 ? 'day' : 'days'}
          </div>
          <div className="text-sm text-gray-500">
            {streak === 0
              ? 'Finish today’s job to start a streak'
              : job.done
                ? 'Streak safe for today'
                : 'Finish today’s job to keep it going'}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6 mb-4">
        <div className="text-sm text-gray-500 mb-3">
          Today{job.done ? ' · done 🎉' : ''}
        </div>
        <button onClick={onStartKana} className="w-full text-left py-3">
          <span className="flex items-center gap-3">
            {check(job.kana)}
            <span className="text-gray-800 font-medium">{banner.kana}</span>
          </span>
          <span className="block mt-2"><Bar frac={kanaN / g.kana} done={job.kana} /></span>
          <span className="block text-sm text-gray-500 mt-1">{Math.min(kanaN, g.kana)} / {g.kana} correct</span>
        </button>
        <button onClick={onStartSecond} className="w-full text-left py-3">
          <span className="flex items-center gap-3">
            {check(job.second)}
            <span className="text-gray-800 font-medium">{banner.second}</span>
          </span>
          <span className="block mt-2"><Bar frac={secondN / g[secondType]} done={job.second} /></span>
          <span className="block text-sm text-gray-500 mt-1">{Math.min(secondN, g[secondType])} / {g[secondType]} correct</span>
        </button>
        {offline && (
          <div className="text-sm text-red-600 mt-2">
            Couldn’t load progress{loadError ? ` (error ${loadError})` : ''}, so these bars may be out of date.
          </div>
        )}
        {saveError && <div className="text-sm text-red-600 mt-2">Last save failed (error {saveError}). It will retry.</div>}
      </div>

      {summary && (
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-4">
          <div className="text-sm text-gray-500 mb-3">Kana gate (last {GATE.window} answers, need {GATE.accuracy * 100}% and under {GATE.avgMs / 1000}s)</div>
          <GateBar label="Hiragana" g={summary.gate.hiragana} />
          <GateBar label="Katakana" g={summary.gate.katakana} />
        </div>
      )}

      <button onClick={onSave} disabled={saving} className="w-full text-center text-sm text-gray-500 py-2">
        {saving
          ? 'Saving…'
          : lastSaved
            ? `Last saved ${lastSaved.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })} ET · tap to save now`
            : 'Saves automatically as you answer'}
      </button>
    </div>
  );
}

function Kana({ log, base, preset, setPreset }) {
  const [script, setScript] = useState('hiragana');
  const [category, setCategory] = useState('basic');
  const [mode, setMode] = useState('choice'); // 'choice' | 'typed'

  const pool = useMemo(
    () => (preset === 'custom' ? buildPool(script, category) : buildPresetPool(preset)),
    [preset, script, category]
  );
  const weights = useRef({});
  const meta = useRef({}); // char -> {seen, correct, avg_ms}, mirrors what's persisted server-side
  const avgTime = useRef(START_AVG_MS);

  const [current, setCurrent] = useState(null);
  const [choices, setChoices] = useState([]);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [result, setResult] = useState(null); // null | 'correct' | 'wrong'
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

  const nextQuestion = (excludeChar) => {
    const next = weightedPick(pool, weights.current, excludeChar);
    setCurrent(next);
    setChoices(mode === 'choice' ? makeChoices(next, pool) : []);
    setTypedAnswer('');
    setResult(null);
    questionStart.current = Date.now();
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
    const elapsed = Date.now() - questionStart.current;
    const w = weights.current[current.char] ?? 1;
    let newWeight;
    if (isCorrect) {
      const fast = elapsed < avgTime.current * 0.8;
      const slow = elapsed > avgTime.current * 1.3;
      newWeight = fast ? Math.max(w * 0.6, MIN_W) : slow ? Math.min(w * 1.3, MAX_W) : w;
      avgTime.current = avgTime.current * 0.9 + elapsed * 0.1;
    } else {
      newWeight = Math.min(w * 2, MAX_W);
    }
    weights.current[current.char] = newWeight;

    const prev = meta.current[current.char] ?? { seen: 0, correct: 0, avg_ms: null };
    const newMeta = {
      seen: prev.seen + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
      avg_ms: Math.round(prev.avg_ms == null ? elapsed : prev.avg_ms * 0.7 + elapsed * 0.3),
    };
    meta.current[current.char] = newMeta;
    fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        script: current.script,
        char: current.char,
        weight: newWeight,
        ...newMeta,
        ms: elapsed,
        isCorrect,
      }),
    }).catch(() => {}); // best-effort; dev mode without functions just won't persist

    log.record(isCorrect, elapsed);
    setStats((s) => ({
      answered: s.answered + 1,
      correct: s.correct + (isCorrect ? 1 : 0),
      streak: isCorrect ? s.streak + 1 : 0,
    }));
    setResult(isCorrect ? 'correct' : 'wrong');
  };

  const submitChoice = (romaji) => {
    if (result) return;
    grade(romaji === current.romaji);
  };

  const submitTyped = (e) => {
    e.preventDefault();
    if (result) return;
    grade(typedAnswer.trim().toLowerCase() === current.romaji);
  };

  if (!current) return null;

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-xl p-4 mb-4 flex flex-wrap gap-3 items-center justify-center">
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className="p-3 border border-gray-300 rounded-lg"
        >
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
        <div className="flex gap-2">
          <button
            onClick={() => setMode('choice')}
            className={`py-3 px-3 rounded-lg text-sm font-medium ${mode === 'choice' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Multiple choice
          </button>
          <button
            onClick={() => setMode('typed')}
            className={`py-3 px-3 rounded-lg text-sm font-medium ${mode === 'typed' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Type it
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
        <TodayProgress log={log} type="kana" base={base} goal={goals(planFor(etDay()).entry).kana} />
        <div className="text-sm text-gray-500 mb-2">
          {stats.correct}/{stats.answered} correct · streak {stats.streak}
        </div>
        <div className="text-8xl font-bold text-gray-800 mb-8">{current.char}</div>

        {mode === 'choice' ? (
          <div className="grid grid-cols-2 gap-3">
            {choices.map((c) => {
              const isChosenWrong = result && c.romaji !== current.romaji && result === 'wrong';
              const isAnswer = result && c.romaji === current.romaji;
              return (
                <button
                  key={c.romaji}
                  onClick={() => submitChoice(c.romaji)}
                  disabled={!!result}
                  className={`min-h-[64px] py-4 rounded-lg text-lg font-medium border-2 ${
                    isAnswer
                      ? 'bg-green-100 border-green-500 text-green-800'
                      : isChosenWrong
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'border-gray-200'
                  }`}
                >
                  {c.romaji}
                </button>
              );
            })}
          </div>
        ) : (
          <form onSubmit={submitTyped} className="flex gap-3 justify-center">
            <input
              autoFocus
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              disabled={!!result}
              className={`p-3 border-2 rounded-lg text-lg text-center w-40 ${
                result === 'correct' ? 'border-green-500 bg-green-50' : result === 'wrong' ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="romaji"
            />
            {!result && (
              <button type="submit" className="py-3 px-6 bg-purple-600 text-white font-bold rounded-lg">
                Check
              </button>
            )}
          </form>
        )}

        {result && (
          <div className="mt-6">
            {result === 'wrong' && <div className="text-red-600 font-medium mb-3">Correct answer: {current.romaji}</div>}
          </div>
        )}
      </div>
      <NextBar enabled={!!result} onNext={() => result && nextQuestion(current.char)} />
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('home'); // 'home' | 'kana' | 'phrases'
  const [preset, setPreset] = useState('custom');
  const [summary, setSummary] = useState(null);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const baseRef = useRef(null); // today's seconds per track as the server had them when the app opened
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showRomaji, setShowRomajiState] = useState(() => {
    try {
      return localStorage.getItem(ROMAJI_KEY) !== '0';
    } catch {
      return true;
    }
  });

  // Every server-confirmed session save updates the "Last saved" line.
  const log = useSessionLog((res) => {
    if (res?.saved_at) {
      setLastSaved(new Date(res.saved_at));
      setSaveError(null);
    } else if (res?.error) setSaveError(res.error);
  });

  const loadSummary = useCallback(
    () =>
      fetch('/api/export')
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data) => {
          setSummary(data);
          setOffline(false);
          setLoadError(null);
          if (!baseRef.current) {
            const t = data.today;
            baseRef.current = { day: data.day, kana: t.kana.correct, words: t.words.correct, phrases: t.phrases.correct };
          }
          setLastSaved((prev) => prev ?? (data.last_sync ? new Date(data.last_sync) : null));
          return data;
        })
        .catch((status) => {
          setOffline(true);
          setLoadError(typeof status === 'number' ? status : null);
          return null;
        }),
    []
  );

  const setShowRomaji = (on) => {
    setShowRomajiState(on);
    try {
      localStorage.setItem(ROMAJI_KEY, on ? '1' : '0');
    } catch {
      // storage unavailable - D1 copy below still applies
    }
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'romaji', value: on ? '1' : '0' }),
    }).catch(() => {});
  };

  // Romaji setting: D1 copy wins over localStorage when available.
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s?.romaji != null) setShowRomajiState(s.romaji !== '0');
      })
      .catch(() => {});
  }, []);

  // Landing on Home (or Stats) flushes any open session, then recomputes progress from the server,
  // so today's job lines check off as they are met across separate sittings.
  useEffect(() => {
    if (tab !== 'home' && tab !== 'stats') return;
    const refresh = () => log.flush().finally(loadSummary);
    refresh();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Every screen change saves the open session first.
  const go = (next) => {
    log.flush();
    setTab(next);
  };

  const startKana = () => {
    const p = planFor(etDay()).entry.kana.preset;
    setPreset(KANA_PRESETS[p] ? p : 'custom');
    go('kana');
  };

  const saveNow = async () => {
    setSaving(true);
    await log.flush();
    await loadSummary();
    setSaving(false);
  };

  const baseFor = (type) => (baseRef.current?.day === etDay() ? baseRef.current[type] : 0);
  const streak = summary?.streak ?? 0;
  const suggestRomajiOff = !!summary?.gate?.hiragana?.pass;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 sm:p-8 pb-[calc(11rem+env(safe-area-inset-bottom))]">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-4">
          <h1 className="text-4xl font-bold text-purple-700">HiraKata</h1>
          {streak > 0 && (
            <span className="flex items-center gap-1 bg-orange-100 text-orange-700 font-bold px-3 py-1 rounded-full text-lg">
              🔥 {streak}
            </span>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          <TabButton id="home" tab={tab} setTab={go}>Home</TabButton>
          <TabButton id="kana" tab={tab} setTab={go}>Kana</TabButton>
          {PLAN.phrasesOn ? (
            <TabButton id="phrases" tab={tab} setTab={go}>Phrases</TabButton>
          ) : (
            <TabButton id="words" tab={tab} setTab={go}>Words</TabButton>
          )}
          <TabButton id="stats" tab={tab} setTab={go}>Stats</TabButton>
        </div>

        {tab === 'home' && (
          <Home
            summary={summary}
            offline={offline}
            loadError={loadError}
            saveError={saveError}
            onStartKana={startKana}
            onStartSecond={() => go(PLAN.phrasesOn ? 'phrases' : 'words')}
            onSave={saveNow}
            saving={saving}
            lastSaved={lastSaved}
          />
        )}
        {tab === 'kana' && <Kana log={log} base={baseFor('kana')} preset={preset} setPreset={setPreset} />}
        {tab === 'words' && !PLAN.phrasesOn && (
          <Words
            log={log}
            base={baseFor('words')}
            showRomaji={showRomaji}
            setShowRomaji={setShowRomaji}
            suggestRomajiOff={suggestRomajiOff}
          />
        )}
        {tab === 'stats' && <Stats summary={summary} />}
        {tab === 'phrases' && PLAN.phrasesOn && (
          <Phrases
            log={log}
            showRomaji={showRomaji}
            setShowRomaji={setShowRomaji}
            suggestRomajiOff={suggestRomajiOff}
          />
        )}
      </div>
    </div>
  );
}
