// Per-item weight update shared by Kana and Words. Wrong answers and slow correct answers raise
// the weight, fast correct answers lower it. Typed answers count a bit more either way, since
// recall (not elimination) is being tested. Weights stay inside [floor, MAX_W]: bounded, no queue.
export const MAX_W = 8;

export function nextWeight({ w, correct, elapsed, avg, floor, typed }) {
  if (!correct) return Math.min(w * (typed ? 2.3 : 2), MAX_W);
  const fast = elapsed < avg * 0.8;
  const slow = elapsed > avg * 1.3;
  if (fast) return Math.max(w * (typed ? 0.5 : 0.6), floor);
  if (slow) return Math.min(w * 1.3, MAX_W);
  return w;
}

// Mix mode: chance that this question is typed. More typed once the item is above `above`.
export function typedChance(mix, seen, correct) {
  const acc = seen >= 5 ? correct / seen : 0;
  return acc > mix.above ? mix.typedHigh : mix.typed;
}
