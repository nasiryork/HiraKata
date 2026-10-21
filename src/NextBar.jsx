import React, { useEffect, useRef } from 'react';

// Next button pinned to the bottom of the screen. It is always there but grey and inert
// until an answer is picked, then it lights up. Pages leave room under their content so the
// bar never covers the answer. Enter or Space also advances once it is enabled.
export default function NextBar({ onNext, enabled }) {
  const cb = useRef(onNext);
  const on = useRef(enabled);
  cb.current = onNext;
  on.current = enabled;

  useEffect(() => {
    const onKey = (e) => {
      if (!on.current || e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
      // Let a focused control (button, checkbox, select) handle its own Enter/Space.
      if (/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(e.target?.tagName ?? '') && !e.target.disabled) return;
      e.preventDefault();
      cb.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-10 bg-white/95 border-t border-gray-200 px-4 pt-3"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <button
        onClick={onNext}
        disabled={!enabled}
        className={`block w-full max-w-2xl mx-auto min-h-[56px] py-3 font-bold rounded-xl transition-colors ${
          enabled ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-400'
        }`}
      >
        Next →
      </button>
    </div>
  );
}
