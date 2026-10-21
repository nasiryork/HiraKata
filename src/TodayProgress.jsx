import React from 'react';

// "Today 12 / 20 correct" with a thin bar. `base` is what the server already counted for this
// track today (earlier sittings); the current page load's correct answers are added live.
// Re-renders whenever the quiz re-renders (every answer), so no timer is needed.
export default function TodayProgress({ log, type, base, goal }) {
  const n = base + log.correctToday(type);
  const done = n >= goal;
  if (done) return null; // finished: the check stays on Home, nowhere else
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Today</span>
        <span>
          {n} / {goal} correct
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, (n / goal) * 100)}%` }} />
      </div>
    </div>
  );
}
