import React, { useState, useRef, useEffect, useCallback } from 'react';
import Phrases from './Phrases.jsx';
import Words from './Words.jsx';
import Kana from './Kana.jsx';
import Stats from './Stats.jsx';
import GateBar from './GateBar.jsx';
import { KeyboardAnchor, primeKeyboard } from './TypedShell.jsx';
import { PLAN } from './data/plan.js';
import { useSessionLog } from './lib/useSessionLog.js';
import { KANA_PRESETS, GATE, planFor, bannerText, goals, isAuto } from './lib/plan.js';
import { etDay } from './lib/et.js';

const ROMAJI_KEY = 'hirakata-show-romaji';
const MODE_KEY = (section) => `hirakata-mode-${section}`;
const MODES = ['choice', 'typed', 'mix'];

const readMode = (section) => {
  try {
    const m = localStorage.getItem(MODE_KEY(section));
    return MODES.includes(m) ? m : 'mix';
  } catch {
    return 'mix';
  }
};

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

function Card({ children, tone = 'purple' }) {
  const tones = { purple: 'bg-purple-50 border-purple-200 text-purple-900', green: 'bg-green-50 border-green-300 text-green-900' };
  return <div className={`border rounded-2xl p-4 mb-4 text-sm ${tones[tone]}`}>{children}</div>;
}

const Btn = ({ onClick, primary, children }) => (
  <button
    onClick={onClick}
    className={`py-2 px-4 rounded-lg font-medium ${primary ? 'bg-purple-600 text-white' : 'bg-white border border-purple-200 text-gray-700'}`}
  >
    {children}
  </button>
);

// Adaptive prompts: nothing changes without a tap, except the words shrink which is announced
// with an Undo. Each action is re-checked on the server against the caps in plan.js.
function AdaptCards({ summary, act }) {
  const a = summary?.words?.adapt;
  const k = summary?.kana;
  const today = etDay();
  const ev = a?.last_event;
  return (
    <>
      {k && (
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <div className="text-sm text-gray-500">Kana level</div>
          <div className="text-lg font-bold text-gray-800">
            {k.level} of 6 · {k.level_label}
          </div>
          <div className="text-sm text-gray-600 mt-1">Next: {k.next}</div>
          {k.level_up && (
            <div className="mt-3 flex items-center gap-3">
              <span className="font-medium text-green-700">Level up? {k.level_up.label}</span>
              <Btn primary onClick={() => act('level_up')}>Yes</Btn>
            </div>
          )}
        </div>
      )}
      {k?.dakuten?.grow.eligible && (
        <Card tone="green">
          <div className="font-medium mb-2">Dakuten is going well. Add {k.dakuten.grow.add} more? ({k.dakuten.pool} of {k.dakuten.total} now)</div>
          <div className="flex gap-2">
            <Btn primary onClick={() => act('dakuten_grow')}>Yes</Btn>
            <Btn onClick={() => act('dakuten_snooze')}>Not yet</Btn>
          </div>
        </Card>
      )}
      {a?.grow.eligible && (
        <Card tone="green">
          <div className="font-medium mb-2">Going well. Add {a.grow.add} words?</div>
          <div className="flex gap-2">
            <Btn primary onClick={() => act('words_grow')}>Yes</Btn>
            <Btn onClick={() => act('words_snooze')}>Not yet</Btn>
          </div>
        </Card>
      )}
      {a?.can_undo && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <span>Paused {a.resting} words so these can settle. Back soon.</span>
            <Btn onClick={() => act('words_undo')}>Undo</Btn>
          </div>
        </Card>
      )}
      {ev?.kind === 'restore' && ev.day === today && (
        <Card>
          <span>{ev.n} paused words are back in the mix.</span>
        </Card>
      )}
    </>
  );
}

function Home({ summary, offline, loadError, saveError, onStartKana, onStartSecond, onSave, saving, lastSaved, act }) {
  const day = etDay();
  const { entry } = planFor(day);
  const banner = bannerText(entry, summary?.kana?.auto);
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

      <AdaptCards summary={summary} act={act} />

      {summary && (
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-4">
          <div className="text-sm text-gray-500 mb-3">Kana gate (last {GATE.window} answers, need {GATE.accuracy * 100}% and under {GATE.avgMs / 1000}s; katakana 2.5s)</div>
          <GateBar label="Hiragana" g={summary.gate.hiragana} />
          <GateBar label="Katakana" g={summary.gate.katakana} needTyped />
          {summary.gate.mixed && <GateBar label="Everything mixed (G4)" g={summary.gate.mixed} needTyped />}
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

export default function App() {
  const [tab, setTab] = useState('home'); // 'home' | 'kana' | 'phrases'
  const [preset, setPresetState] = useState('custom');
  const [autoBg, setAutoBg] = useState(false); // app-picked job: lower levels stay in the mix at low weight
  const [modes, setModes] = useState(() => ({ kana: readMode('kana'), words: readMode('words') }));
  const setPreset = (p) => {
    setAutoBg(false);
    setPresetState(p);
  };
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

  // Choose / Type / Mix, remembered per section (D1 copy wins over localStorage, like romaji).
  const setMode = (section) => (mode) => {
    setModes((m) => ({ ...m, [section]: mode }));
    try {
      localStorage.setItem(MODE_KEY(section), mode);
    } catch {
      // storage unavailable
    }
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: `mode_${section}`, value: mode }),
    }).catch(() => {});
  };

  // Adaptive card taps (grow / snooze / undo / level up), then refresh what Home shows.
  const act = (action) =>
    fetch('/api/adapt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
      .catch(() => {})
      .finally(loadSummary);

  // Romaji setting: D1 copy wins over localStorage when available.
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s?.romaji != null) setShowRomajiState(s.romaji !== '0');
        setModes((m) => ({
          kana: MODES.includes(s?.mode_kana) ? s.mode_kana : m.kana,
          words: MODES.includes(s?.mode_words) ? s.mode_words : m.words,
        }));
      })
      .catch(() => {});
  }, []);

  // Landing on Home (or Stats) flushes any open session, then recomputes progress from the server,
  // so today's job lines check off as they are met across separate sittings.
  useEffect(() => {
    if (tab !== 'home' && tab !== 'stats') return;
    // Session end: save, let the server run its once-a-day grow/shrink check, then redraw Home.
    const refresh = () =>
      log
        .flush()
        .then(() => fetch('/api/adapt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'eval' }) }))
        .catch(() => {})
        .finally(loadSummary);
    refresh();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Every screen change saves the open session first.
  const go = (next) => {
    log.flush();
    // Open the keyboard inside this tap when the section can ask typed questions (iOS needs a gesture).
    if ((next === 'kana' && modes.kana !== 'choice') || (next === 'words' && modes.words !== 'choice')) primeKeyboard();
    setTab(next);
  };

  // Today's kana job: the app's pick from his weakest level, unless plan.js names a preset.
  const startKana = () => {
    const entry = planFor(etDay()).entry;
    if (isAuto(entry) && summary?.kana?.auto) {
      setPresetState(summary.kana.auto.preset);
      setAutoBg(true);
    } else {
      setPresetState(KANA_PRESETS[entry.kana.preset] ? entry.kana.preset : 'custom');
      setAutoBg(false);
    }
    go('kana');
  };
  const goTab = (id) => (id === 'kana' ? startKana() : go(id));

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
      <KeyboardAnchor />
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
          <TabButton id="home" tab={tab} setTab={goTab}>Home</TabButton>
          <TabButton id="kana" tab={tab} setTab={goTab}>Kana</TabButton>
          {PLAN.phrasesOn ? (
            <TabButton id="phrases" tab={tab} setTab={goTab}>Phrases</TabButton>
          ) : (
            <TabButton id="words" tab={tab} setTab={goTab}>Words</TabButton>
          )}
          <TabButton id="stats" tab={tab} setTab={goTab}>Stats</TabButton>
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
            act={act}
          />
        )}
        {tab === 'kana' && (
          <Kana
            log={log}
            base={baseFor('kana')}
            preset={preset}
            setPreset={setPreset}
            autoBg={autoBg}
            level={summary?.kana?.level ?? 4}
            dakutenK={summary?.kana?.dakuten?.pool ?? 50}
            mode={modes.kana}
            setMode={setMode('kana')}
            onHome={() => go('home')}
          />
        )}
        {tab === 'words' && !PLAN.phrasesOn && (
          <Words
            log={log}
            base={baseFor('words')}
            showRomaji={showRomaji}
            setShowRomaji={setShowRomaji}
            suggestRomajiOff={suggestRomajiOff}
            mode={modes.words}
            setMode={setMode('words')}
            onHome={() => go('home')}
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
