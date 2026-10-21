// Server-side progress summary, shared by /api/export and /api/session (job check).
import { PHRASES } from '../data/phrases.js';
import { PLAN, WORDS_RULE } from '../data/plan.js';
import { getPoolState, wordRows, isKnown, nextBatchAt, poolWords, loadWordList } from './words.js';
import { etDay, addDays } from './et.js';
import { planFor, jobStatus, GATE, WEAK } from './plan.js';

const EMPTY = { seconds: 0, questions: 0, correct: 0 };

export async function dayAgg(db, day) {
  const { results } = await db
    .prepare(
      `SELECT substr(mode, 1, instr(mode, ':') - 1) AS type, SUM(seconds) AS seconds,
              SUM(questions) AS questions, SUM(correct) AS correct
       FROM session_log WHERE day = ? GROUP BY type`
    )
    .bind(day)
    .all();
  const agg = { kana: { ...EMPTY }, words: { ...EMPTY }, phrases: { ...EMPTY } };
  for (const r of results) {
    if (agg[r.type]) agg[r.type] = { seconds: r.seconds, questions: r.questions, correct: r.correct };
  }
  return agg;
}

export async function streakInfo(db, day) {
  const row = await db.prepare('SELECT last_date, streak FROM daily_streak WHERE id = 1').first();
  const live = row && (row.last_date === day || row.last_date === addDays(day, -1));
  return { streak: live ? row.streak : 0, doneToday: row?.last_date === day };
}

// Marks the day done (bumps the streak once) if both job lines are met.
export async function settleJob(db, day) {
  const { entry } = planFor(day);
  const job = jobStatus(entry, await dayAgg(db, day));
  let info = await streakInfo(db, day);
  if (job.done && !info.doneToday) {
    const row = await db.prepare('SELECT last_date, streak FROM daily_streak WHERE id = 1').first();
    const streak = row?.last_date === addDays(day, -1) ? row.streak + 1 : 1;
    await db
      .prepare(
        `INSERT INTO daily_streak (id, last_date, streak) VALUES (1, ?, ?)
         ON CONFLICT (id) DO UPDATE SET last_date = ?, streak = ?`
      )
      .bind(day, streak, day, streak)
      .run();
    info = { streak, doneToday: true };
  }
  return { job, ...info };
}

async function gate(db, script) {
  const { results } = await db
    .prepare('SELECT correct, ms FROM answer_log WHERE script = ? ORDER BY id DESC LIMIT ?')
    .bind(script, GATE.window)
    .all();
  const n = results.length;
  if (!n) return { n: 0, accuracy: null, avg_ms: null, pass: false };
  const accuracy = results.reduce((s, r) => s + r.correct, 0) / n;
  const avg_ms = Math.round(results.reduce((s, r) => s + r.ms, 0) / n);
  return { n, accuracy, avg_ms, pass: n >= GATE.window && accuracy >= GATE.accuracy && avg_ms < GATE.avgMs };
}

export async function buildSummary(db) {
  const day = etDay();
  const { week, weekFrom, entry } = planFor(day);
  const [agg, st, hira, kata, sessionsWeek, charStats, phraseStats, log, sync, poolState, wRows, wordList] = await Promise.all([
    dayAgg(db, day),
    streakInfo(db, day),
    gate(db, 'hiragana'),
    gate(db, 'katakana'),
    db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(seconds), 0) AS s FROM session_log WHERE day >= ?').bind(weekFrom).first(),
    db.prepare('SELECT script, char, weight, seen, correct, avg_ms, last_seen FROM character_stats').all(),
    db.prepare('SELECT id, weight, seen, correct, said_count, said_days, last_said_day FROM phrase_stats').all(),
    db
      .prepare('SELECT id, day, started_at, mode, preset, questions, correct, avg_ms, seconds FROM session_log WHERE day >= ? ORDER BY id')
      .bind(addDays(day, -13))
      .all(),
    db.prepare("SELECT value FROM settings WHERE key = 'last_sync'").first(),
    getPoolState(db, day),
    wordRows(db),
    loadWordList(db),
  ]);

  const job = jobStatus(entry, agg);
  const weak = charStats.results
    .filter((r) => r.seen >= WEAK.minSeen && r.correct / r.seen < WEAK.accuracy)
    .sort((a, b) => a.correct / a.seen - b.correct / b.seen)
    .map((r) => ({ char: r.char, script: r.script, accuracy: r.correct / r.seen }));

  const released = PHRASES.filter((p) => p.tier <= entry.phrases.newTier);
  const byId = new Map(phraseStats.results.map((r) => [r.id, r]));
  const said = released.filter((p) => {
    const s = byId.get(p.id);
    return s && s.said_count >= 3 && s.said_days >= 2;
  }).length;
  // "free" is reported as released phrases not yet seen in a quiz.
  const free = released.filter((p) => !byId.get(p.id)?.seen).length;

  // Words track: pool = first N words by id; known per the counter rule in lib/words.js.
  const pool = poolWords(wordList, poolState.size);
  const poolRows = pool.map((w) => ({ w, r: wRows.get(w.id) }));
  const wordsKnown = poolRows.filter(({ r }) => isKnown(r)).length;
  const wordsSeen = poolRows.filter(({ r }) => r?.seen).length;
  const timed = poolRows.filter(({ r }) => r?.avg_ms != null);
  const wordsAvg = timed.length ? Math.round(timed.reduce((sum, { r }) => sum + r.avg_ms, 0) / timed.length) : null;
  const wordsWeak = poolRows
    .filter(({ r }) => r && r.seen >= WORDS_RULE.weakMinSeen && r.correct / r.seen < WORDS_RULE.weakAccuracy)
    .sort((a, b) => a.r.correct / a.r.seen - b.r.correct / b.r.seen)
    .map(({ w, r }) => ({ id: w.id, jp: w.jp, en: w.en, group: w.group, accuracy: r.correct / r.seen, avg_ms: r.avg_ms }));
  const words = {
    released: pool.length,
    total: wordList.length,
    seen: wordsSeen,
    known: wordsKnown,
    avg_ms: wordsAvg,
    next_batch_at: pool.length >= wordList.length ? null : nextBatchAt(pool.length),
    pool_since: poolState.since,
    weak: wordsWeak,
  };

  const pct = (g) => (g.accuracy == null ? '-' : `${Math.round(g.accuracy * 100)}% / ${(g.avg_ms / 1000).toFixed(1)}s`);
  const text = [
    `HiraKata export ${day} (ET)`,
    `Streak ${st.streak} | Week: ${sessionsWeek.n} sessions, ${Math.round(sessionsWeek.s / 60)} min`,
    `Kana gate: hiragana ${pct(hira)} (need ${GATE.accuracy * 100}% / ${(GATE.avgMs / 1000).toFixed(1)}s) | katakana ${pct(kata)}`,
    `Weak (seen>=${WEAK.minSeen}, <${WEAK.accuracy * 100}%): ${
      weak.length ? weak.map((w) => `${w.char} ${Math.round(w.accuracy * 100)}%`).join(', ') : 'none'
    }`,
    `Words: ${words.released} released, ${words.known} known, ${words.next_batch_at == null ? 'all released' : `next batch at ${words.next_batch_at}`}`,
    ...(PLAN.phrasesOn ? [`Phrases: ${released.length} released, ${said} said, ${free} free`] : []),
    `Today's job: ${job.done ? 'done' : `kana ${job.kana ? 'done' : 'open'}, ${PLAN.phrasesOn ? 'phrases' : 'words'} ${job.second ? 'done' : 'open'}`}`,
  ].join('\n');

  return {
    day,
    text,
    last_sync: sync?.value ?? null,
    streak: st.streak,
    week,
    plan: entry,
    job,
    today: agg,
    gate: { hiragana: hira, katakana: kata, need: GATE },
    weak,
    words,
    phrases: { on: PLAN.phrasesOn, released: released.length, said, free },
    character_stats: charStats.results,
    phrase_stats: phraseStats.results,
    word_stats: [...wRows.values()].map((r) => ({ ...r, known: isKnown(r) })),
    session_log: log.results,
  };
}
