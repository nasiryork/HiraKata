// Per-character weights and stats, loaded once at app start and shared by every Kana mount, so
// entering the Kana screen (and the first Type question) does not wait on a network round trip.
export const kanaStore = { weights: {}, meta: {}, ready: null };

export function loadKanaStore() {
  if (!kanaStore.ready) {
    kanaStore.ready = fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        for (const row of Object.values(data)) {
          kanaStore.weights[row.char] = row.weight;
          kanaStore.meta[row.char] = { seen: row.seen, correct: row.correct, avg_ms: row.avg_ms };
        }
      })
      .catch(() => {}); // plain `vite dev`: no API, in-memory only
  }
  return kanaStore.ready;
}
