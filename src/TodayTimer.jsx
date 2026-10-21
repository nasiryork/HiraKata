import React, { useEffect, useState } from 'react';

export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// "Today 2:14 / 5:00" with a thin bar. Active time for this track today: what the server
// already has from earlier sittings (`base`) plus this page load, ticking live.
export default function TodayTimer({ log, type, base, goalMinutes }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = base + log.todaySeconds(type);
  const goal = goalMinutes * 60;
  const done = secs >= goal;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>⏱ Today</span>
        <span className={done ? 'text-green-600 font-medium' : ''}>
          {mmss(secs)} / {mmss(goal)}
          {done ? ' ✓' : ''}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${done ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${Math.min(100, (secs / goal) * 100)}%` }} />
      </div>
    </div>
  );
}
