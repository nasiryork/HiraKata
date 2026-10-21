// Server-side adaptation: words grow/shrink, dakuten batches, kana level ladder, today's auto job.
// All of it resizes or re-mixes a bounded pool from his own answers; nothing is scheduled.
import { ADAPT as A } from '../data/plan.js';
import { activeWords, getPoolState, isKnown, loadWordList, wordRows } from './words.js';
import { DAKUTEN_ORDER, LEVELS, levelByKey, levelMet, needText, unlockedKeys, windowStats } from './kana.js';

export async function readSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

export const putSettings = (db, obj) =>
  db.batch(
    Object.entries(obj).map(([k, v]) =>
      db
        .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = ?')
        .bind(k, String(v), String(v))
    )
  );

const parseJson = (v) => {
  try {
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};

async function wordWindow(db, from, n) {
  const { results } = await db
    .prepare('SELECT id, correct, ms FROM word_answer_log WHERE id > ? ORDER BY id DESC LIMIT ?')
    .bind(from, n)
    .all();
  const c = results.reduce((s, r) => s + r.correct, 0);
  return {
    n: results.length,
    acc: results.length ? c / results.length : null,
    avg_ms: results.length ? Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length) : null,
  };
}

async function maxId(db, table) {
  const r = await db.prepare(`SELECT MAX(id) AS m FROM ${table}`).first();
  return r?.m ?? 0;
}

export async function answerRows(db) {
  try {
    const { results } = await db.prepare('SELECT id, char, correct, ms, typed, day FROM answer_log ORDER BY id DESC LIMIT 3000').all();
    return results;
  } catch {
    return []; // 0005 not applied yet
  }
}

// --- words ---

export async function wordsAdapt(db, day, s) {
  let win;
  try {
    win = await wordWindow(db, Number(s.words_window_from ?? 0), Math.max(A.grow.n, A.shrink.n));
  } catch {
    return null; // 0005 not applied yet
  }
  const [pool, list, rows] = await Promise.all([getPoolState(db, day), loadWordList(db), wordRows(db)]);
  const last = parseJson(s.words_last_event);
  const addedToday = s.words_added_day === day ? Number(s.words_added_n ?? 0) : 0;
  const changedToday = s.words_change_day === day;
  const active = activeWords(list, pool.size, pool.resting);
  const known = active.filter((w) => isKnown(rows.get(w.id))).length;
  const add = Math.max(0, Math.min(A.grow.add, A.grow.maxPerDay - addedToday, list.length - pool.size));
  const growOk =
    win.n >= A.grow.n && win.acc >= A.grow.acc && win.avg_ms < A.grow.ms && add > 0 && !pool.resting.length &&
    s.words_grow_snooze !== day && !(changedToday && last && ['shrink', 'restore'].includes(last.kind));
  return {
    size: pool.size,
    total: list.length,
    active: active.length,
    resting: pool.resting.length,
    resting_ids: pool.resting,
    known,
    window: win,
    grow: { eligible: growOk, add },
    last_event: last,
    can_undo: last?.kind === 'shrink' && !!last.ids?.some((id) => pool.resting.includes(id)),
    _list: list,
    _rows: rows,
    _pool: pool,
    _changedToday: changedToday,
  };
}

// Session-end check: rest the newest unlearned words when it is going badly, bring them back
// when it recovers. One change per ET day, never below minPool.
async function evalWords(db, day, s) {
  const w = await wordsAdapt(db, day, s);
  if (!w || w._changedToday) return;
  const { n, acc } = w.window;
  const R = A.shrink;
  if (n < R.n) return;
  const mark = await maxId(db, 'word_answer_log');
  if (w._pool.resting.length && acc >= R.restoreAcc) {
    const ids = w._pool.resting.slice(-R.rest);
    await putSettings(db, {
      words_resting: JSON.stringify(w._pool.resting.filter((id) => !ids.includes(id))),
      words_window_from: mark,
      words_change_day: day,
      words_last_event: JSON.stringify({ kind: 'restore', day, n: ids.length, ids }),
    });
    return;
  }
  if (acc < R.acc) {
    const room = w.active - R.minPool;
    if (room <= 0) return;
    const ids = w._list
      .slice(0, w.size)
      .filter((x) => !w._pool.resting.includes(x.id) && !isKnown(w._rows.get(x.id)))
      .map((x) => x.id)
      .sort((a, b) => b - a)
      .slice(0, Math.min(R.rest, room));
    if (!ids.length) return;
    await putSettings(db, {
      words_resting: JSON.stringify([...w._pool.resting, ...ids]),
      words_window_from: mark,
      words_change_day: day,
      words_last_event: JSON.stringify({ kind: 'shrink', day, n: ids.length, ids }),
    });
  }
}

// --- dakuten batches ---

export function dakutenState(rows, s, day) {
  const K = Number(s.dakuten_pool ?? A.dakuten.start);
  const from = Number(s.dakuten_window_from ?? 0);
  const set = new Set(DAKUTEN_ORDER.map((k) => k.char));
  const win = windowStats(rows.filter((r) => r.id > from && set.has(r.char)), 'all', K, A.dakuten.n);
  const next = Math.min(A.dakuten.batch, DAKUTEN_ORDER.length - K);
  return {
    pool: K,
    total: DAKUTEN_ORDER.length,
    window: win,
    grow: {
      eligible: win.n >= A.dakuten.n && win.acc >= A.dakuten.growAcc && next > 0 && s.dakuten_grow_snooze !== day && s.dakuten_change_day !== day,
      add: next,
    },
    last_event: parseJson(s.dakuten_last_event),
  };
}

async function evalDakuten(db, day, s, rows) {
  const d = dakutenState(rows, s, day);
  if (s.dakuten_change_day === day || d.window.n < A.dakuten.n) return;
  if (d.window.acc < A.dakuten.shrinkAcc && d.pool > A.dakuten.start) {
    const pool = Math.max(A.dakuten.start, d.pool - A.dakuten.batch);
    await putSettings(db, {
      dakuten_pool: pool,
      dakuten_window_from: rows[0]?.id ?? 0,
      dakuten_change_day: day,
      dakuten_last_event: JSON.stringify({ kind: 'shrink', day, n: d.pool - pool }),
    });
  }
}

// --- kana levels ---

const pctText = (w) => (w.acc == null ? 'no answers yet' : `${Math.round(w.acc * 100)}% over ${w.n}`);

export function kanaState(rows, s) {
  const unlocked = Math.min(6, Math.max(1, Number(s.kana_level ?? A.startLevel)));
  const K = Number(s.dakuten_pool ?? A.dakuten.start);
  const levels = LEVELS.map((l) => ({ ...l, window: windowStats(rows, l.key, K, A.levelNeed[l.n].n) }));
  const cur = levels[unlocked - 1];
  const nextLevel = LEVELS[unlocked]; // undefined at level 6
  const met = levelMet(unlocked, cur.window);
  const next = nextLevel
    ? `${nextLevel.label}. Clear ${cur.label} first: ${needText(unlocked)} (now ${pctText(cur.window)})`
    : `Gate G4: ${needText(6)} (now ${pctText(cur.window)})`;

  // Today's job: the newest unlocked level while it is still new, otherwise the weakest one.
  let pick;
  if (unlocked === 6) pick = levelByKey('all');
  else if (cur.window.n < 20) pick = cur;
  else {
    const cand = levels.filter((l) => l.n <= unlocked && l.window.n >= 10).sort((a, b) => a.window.acc - b.window.acc || b.n - a.n);
    pick = cand[0] ?? cur;
  }
  const recent = rows.slice(0, 500);
  const acc = (rs) => (rs.length ? rs.reduce((x, r) => x + r.correct, 0) / rs.length : null);
  const typed = recent.filter((r) => r.typed);
  const choice = recent.filter((r) => !r.typed);
  return {
    level: unlocked,
    level_label: LEVELS[unlocked - 1].label,
    unlocked: unlockedKeys(unlocked),
    next,
    level_up: met && nextLevel ? { to: nextLevel.n, label: nextLevel.label } : null,
    auto: { preset: pick.key, label: pick.label },
    levels: levels.map((l) => ({ n: l.n, label: l.label, answers: l.window.n, accuracy: l.window.acc, avg_ms: l.window.avg_ms })),
    accuracy: {
      choice: { n: choice.length, accuracy: acc(choice) },
      typed: { n: typed.length, accuracy: acc(typed) },
    },
  };
}

// --- entry points ---

export async function adaptSummary(db, day) {
  const s = await readSettings(db);
  const rows = await answerRows(db);
  const w = await wordsAdapt(db, day, s);
  let words = null;
  if (w) {
    const { _list, _rows, _pool, _changedToday, ...pub } = w;
    words = pub;
  }
  return { words, dakuten: dakutenState(rows, s, day), kana: kanaState(rows, s) };
}

export async function applyAction(db, day, action) {
  const s = await readSettings(db);
  const rows = await answerRows(db);

  if (action === 'eval') {
    await evalWords(db, day, s).catch(() => {});
    await evalDakuten(db, day, s, rows).catch(() => {});
  } else if (action === 'words_grow') {
    const w = await wordsAdapt(db, day, s);
    if (!w?.grow.eligible) return;
    const addedToday = (s.words_added_day === day ? Number(s.words_added_n ?? 0) : 0) + w.grow.add;
    await putSettings(db, {
      words_pool_size: w.size + w.grow.add,
      words_pool_since: day,
      words_added_day: day,
      words_added_n: addedToday,
      words_window_from: await maxId(db, 'word_answer_log'),
      words_change_day: day,
      words_last_event: JSON.stringify({ kind: 'grow', day, n: w.grow.add }),
    });
  } else if (action === 'words_snooze') {
    await putSettings(db, { words_grow_snooze: day });
  } else if (action === 'words_undo') {
    const w = await wordsAdapt(db, day, s);
    if (!w?.can_undo) return;
    const ids = w.last_event.ids;
    await putSettings(db, {
      words_resting: JSON.stringify(w._pool.resting.filter((id) => !ids.includes(id))),
      words_window_from: await maxId(db, 'word_answer_log'),
      words_last_event: JSON.stringify({ kind: 'undo', day, n: ids.length }),
    });
  } else if (action === 'dakuten_grow') {
    const d = dakutenState(rows, s, day);
    if (!d.grow.eligible) return;
    await putSettings(db, {
      dakuten_pool: d.pool + d.grow.add,
      dakuten_window_from: rows[0]?.id ?? 0,
      dakuten_change_day: day,
      dakuten_last_event: JSON.stringify({ kind: 'grow', day, n: d.grow.add }),
    });
  } else if (action === 'dakuten_snooze') {
    await putSettings(db, { dakuten_grow_snooze: day });
  } else if (action === 'level_up') {
    const k = kanaState(rows, s);
    if (k.level_up) await putSettings(db, { kana_level: k.level_up.to, kana_level_day: day });
  }
}
