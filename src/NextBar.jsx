import React, { useEffect, useRef } from 'react';

// Next button pinned to the bottom of the viewport, so it is reachable without scrolling
// however tall the feedback is. Enter or Space also advances.
export default function NextBar({ onNext }) {
  const cb = useRef(onNext);
  cb.current = onNext;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.repeat) return;
      // Let a focused control (button, checkbox, select) handle its own Enter/Space.
      if (/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(e.target?.tagName ?? '') && !e.target.disabled) return;
      e.preventDefault();
      cb.current();
    };
    // Defer one tick: the Enter that submitted a typed answer must not also trigger Next.
    const t = setTimeout(() => window.addEventListener('keydown', onKey), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="sticky bottom-0 -mx-2 px-2 pt-3 pb-4 mt-4 bg-gradient-to-t from-white via-white to-transparent">
      <button onClick={onNext} className="w-full min-h-[56px] py-3 bg-purple-600 text-white font-bold rounded-xl">
        Next →
      </button>
    </div>
  );
}
