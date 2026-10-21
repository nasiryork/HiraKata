import React from 'react';
import { GATE } from './lib/plan.js';

export default function GateBar({ label, g }) {
  const accPct = g.accuracy == null ? 0 : g.accuracy / GATE.accuracy;
  const speedPct = g.avg_ms == null ? 0 : Math.min(1, GATE.avgMs / g.avg_ms);
  const progress = Math.round(Math.min(1, accPct, speedPct) * 100);
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-800">{label}</span>
        <span className="text-gray-600">
          {g.accuracy == null
            ? 'no answers yet'
            : `${Math.round(g.accuracy * 100)}% / ${(g.avg_ms / 1000).toFixed(1)}s`}
          {g.pass ? ' ✓' : ''}
        </span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${g.pass ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
