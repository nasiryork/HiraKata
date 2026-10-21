import React, { useState, useEffect, useMemo } from 'react';
import { WORDS } from './data/words.js';
import { GATE } from './lib/plan.js';
import GateBar from './GateBar.jsx';

const pct = (c, s) => (s ? Math.round((c / s) * 100) : null);
const secs = (ms) => (ms == null ? '–' : `${(ms / 1000).toFixed(1)}s`);

// Weakest first: lowest accuracy, then slowest, then highest weight. Unseen items are left out.
const weakestFirst = (a, b) =>
  a.correct / a.seen - b.correct / b.seen || (b.avg_ms ?? 0) - (a.avg_ms ?? 0) || b.weight - a.weight;

function Row({ label, sub, row, badge }) {
  const acc = pct(row.correct, row.seen);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="w-24 shrink-0">
        <div className="text-xl text-gray-800 leading-tight">{label}</div>
        {sub && <div className="text-xs text-gray-500 truncate">{sub}</div>}
      </div>
      <div className="flex-1 grid grid-cols-4 gap-1 text-sm text-center">
        <span className={acc < 85 ? 'text-red-600 font-medium' : 'text-gray-800'}>{acc}%</span>
        <span className="text-gray-700">{secs(row.avg_ms)}</span>
        <span className="text-gray-700">{row.weight.toFixed(1)}</span>
        <span className="text-gray-500">{row.seen}×{badge ? ` ${badge}` : ''}</span>
      </div>
    </div>
  );
}

const Header = () => (
  <div className="flex items-center gap-3 pb-1 text-xs text-gray-500 border-b border-gray-200">
    <div className="w-24 shrink-0" />
    <div className="flex-1 grid grid-cols-4 gap-1 text-center">
      <span>accuracy</span>
      <span>avg time</span>
      <span>weight</span>
      <span>seen</span>
    </div>
  </div>
);

export default function Stats({ summary }) {
  const [view, setView] = useState('kana'); // 'kana' | 'words'
  const [script, setScript] = useState('hiragana');
  const [kana, setKana] = useState(null);
  const [words, setWords] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setKana(Object.values(d)))
      .catch(() => setError(true));
    fetch('/api/words')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setWords)
      .catch(() => setError(true));
  }, []);

  const kanaRows = useMemo(
    () => (kana ?? []).filter((r) => r.script === script && r.seen > 0).sort(weakestFirst),
    [kana, script]
  );

  const wordGroups = useMemo(() => {
    if (!words) return [];
    const byGroup = new Map();
    for (const w of WORDS.slice(0, words.pool_size)) {
      const row = words.words[w.id];
      if (!row?.seen) continue;
      if (!byGroup.has(w.group)) byGroup.set(w.group, []);
      byGroup.get(w.group).push({ w, row });
    }
    return [...byGroup.entries()].map(([group, items]) => ({
      group,
      items: items.sort((a, b) => weakestFirst(a.row, b.row)),
    }));
  }, [words]);

  const tab = (id, text) => (
    <button
      onClick={() => setView(id)}
      className={`flex-1 py-3 rounded-lg font-medium ${view === id ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
    >
      {text}
    </button>
  );

  return (
    <div>
      {summary && (
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-4">
          <div className="text-sm text-gray-500 mb-3">
            Kana gate (last {GATE.window} answers, need {GATE.accuracy * 100}% and under {GATE.avgMs / 1000}s)
          </div>
          <GateBar label="Hiragana" g={summary.gate.hiragana} />
          <GateBar label="Katakana" g={summary.gate.katakana} />
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl p-4">
        <div className="flex gap-2 mb-4">
          {tab('kana', 'Kana')}
          {tab('words', 'Words')}
        </div>
        {error && !kana && !words && <div className="text-sm text-gray-500">Stats need the live app (offline / dev mode).</div>}

        {view === 'kana' && (
          <>
            <div className="flex gap-2 mb-3">
              {['hiragana', 'katakana'].map((s) => (
                <button
                  key={s}
                  onClick={() => setScript(s)}
                  className={`px-4 py-2 rounded-full text-sm ${script === s ? 'bg-purple-100 text-purple-700 font-medium' : 'bg-gray-100 text-gray-600'}`}
                >
                  {s === 'hiragana' ? 'Hiragana' : 'Katakana'}
                </button>
              ))}
            </div>
            <Header />
            {kana && !kanaRows.length && <div className="text-sm text-gray-500 py-3">No answers yet.</div>}
            {kanaRows.map((r) => (
              <Row key={r.char} label={r.char} row={r} />
            ))}
          </>
        )}

        {view === 'words' && (
          <>
            {words && (
              <div className="text-sm text-gray-600 mb-3">
                Pool {words.pool_size} of {WORDS.length} · ✓ = known
              </div>
            )}
            <Header />
            {words && !wordGroups.length && <div className="text-sm text-gray-500 py-3">No answers yet.</div>}
            {wordGroups.map(({ group, items }) => (
              <div key={group} className="mt-4">
                <div className="text-sm font-bold text-purple-700 mb-1">{group}</div>
                {items.map(({ w, row }) => (
                  <Row key={w.id} label={w.jp} sub={w.en} row={row} badge={row.known ? '✓' : ''} />
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
