import React from 'react';
import { GATE } from './lib/plan.js';
import { ADAPT } from './data/plan.js';
import { accColor, accFill, speedFrac } from './lib/color.js';

// One gate row: accuracy and speed numbers in the shared red-yellow-green scale (numbers stay
// visible), a bar showing how close both are to the pass line. `needTyped` gates also need a few
// typed answers in the window, so they are not passed on multiple choice alone.
export default function GateBar({ label, g, needTyped }) {
  const cut = g.need_ms ?? GATE.avgMs;
  const accPct = g.accuracy == null ? 0 : g.accuracy / GATE.accuracy;
  const speedPct = g.avg_ms == null ? 0 : Math.min(1, cut / g.avg_ms);
  const progress = Math.min(1, accPct, speedPct);
  const typedMissing = needTyped && g.n >= GATE.window && g.accuracy >= GATE.accuracy && g.typed < ADAPT.minTyped;
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-800">{label}</span>
        <span className="text-gray-600">
          {g.accuracy == null ? (
            'no answers yet'
          ) : (
            <>
              <span style={{ color: accColor(g.accuracy) }} className="font-medium">{Math.round(g.accuracy * 100)}%</span>
              {' / '}
              <span style={{ color: accColor(speedFrac(g.avg_ms, cut)) }} className="font-medium">{(g.avg_ms / 1000).toFixed(1)}s</span>
            </>
          )}
          {g.pass ? ' ✓' : ''}
        </span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full" style={{ width: `${Math.round(progress * 100)}%`, background: g.pass ? accFill(1) : accFill(progress) }} />
      </div>
      {needTyped && g.accuracy != null && (
        <div className="text-xs text-gray-500 mt-1">
          typed {g.typed ?? 0}/{ADAPT.minTyped} needed in the window{typedMissing ? ' · use Type or Mix to finish this gate' : ''}
        </div>
      )}
    </div>
  );
}
