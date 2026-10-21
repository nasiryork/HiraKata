import React, { useEffect } from 'react';

// The typed-answer screen. It is a fixed column exactly as tall as the *visible* viewport
// (visualViewport shrinks when the iPhone keyboard opens), so the layout is resized once and the
// Check/Next button rides directly on top of the keyboard. Top to bottom: header, prompt, input,
// button. The input element is never remounted and never blurs while typing: the button swallows
// pointerdown (so tapping it does not dismiss the keyboard) and, after an answer, the input goes
// read-only instead of disabled. Enter = Check, then Enter = Next.
//
// The shell stays mounted (invisible) between typed questions so the parent can focus the same
// input synchronously inside the tap that advances to the next typed question; iOS only opens the
// keyboard for focus() called inside a user gesture.

// Static input outside React; focusing it inside a tap lets later programmatic focus() calls on
// the real input succeed on iOS while the keyboard is already up.
export const KEYBOARD_ANCHOR_ID = 'kb-anchor';
export const primeKeyboard = () => document.getElementById(KEYBOARD_ANCHOR_ID)?.focus({ preventScroll: true });
export const dropKeyboard = () => document.activeElement?.blur?.();

export function KeyboardAnchor() {
  return (
    <input
      id={KEYBOARD_ANCHOR_ID}
      aria-hidden="true"
      tabIndex={-1}
      readOnly
      autoComplete="off"
      className="fixed left-0 top-0 w-px h-px opacity-0 pointer-events-none"
      style={{ fontSize: 16 }}
    />
  );
}

function useVisibleViewport(active) {
  useEffect(() => {
    if (!active) return undefined;
    const root = document.documentElement;
    const vv = window.visualViewport;
    const set = () => {
      const h = vv ? vv.height : window.innerHeight;
      const keyboardUp = window.innerHeight - h > 120;
      root.style.setProperty('--vvh', `${h}px`);
      root.style.setProperty('--vvt', `${vv ? vv.offsetTop : 0}px`);
      root.style.setProperty('--vvpb', keyboardUp ? '8px' : 'max(8px, env(safe-area-inset-bottom))');
      if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
    };
    root.classList.add('typing');
    set();
    vv?.addEventListener('resize', set);
    vv?.addEventListener('scroll', set);
    window.addEventListener('resize', set);
    return () => {
      vv?.removeEventListener('resize', set);
      vv?.removeEventListener('scroll', set);
      window.removeEventListener('resize', set);
      root.classList.remove('typing');
      ['--vvh', '--vvt', '--vvpb'].forEach((p) => root.style.removeProperty(p));
    };
  }, [active]);
}

export default function TypedShell({ active, inputRef, value, onChange, answered, correct, onCheck, onNext, header, children, feedback }) {
  useVisibleViewport(active);

  const submit = () => {
    if (answered) onNext();
    else if (value.trim()) onCheck();
  };

  return (
    <div
      aria-hidden={!active}
      className={`fixed left-0 right-0 top-0 z-30 flex flex-col bg-gradient-to-br from-purple-50 to-pink-100 ${
        active ? '' : 'opacity-0 pointer-events-none'
      }`}
      style={{ height: 'var(--vvh, 100dvh)', transform: 'translateY(var(--vvt, 0px))' }}
    >
      <div className="shrink-0 px-3 pt-3 max-w-2xl w-full mx-auto">{active && header}</div>
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-2 flex flex-col items-center justify-center text-center"
        onPointerDown={() => inputRef.current?.focus({ preventScroll: true })}
      >
        {active && children}
        {active && answered && feedback}
      </div>
      <div className="shrink-0 px-4 pt-2 max-w-2xl w-full mx-auto" style={{ paddingBottom: 'var(--vvpb, 8px)' }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          readOnly={answered}
          tabIndex={active ? 0 : -1}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            e.preventDefault();
            submit();
          }}
          placeholder="romaji"
          inputMode="text"
          enterKeyHint="go"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          data-form-type="other"
          data-lpignore="true"
          style={{ fontSize: 20 }}
          className={`block w-full p-3 border-2 rounded-xl text-center outline-none ${
            answered
              ? correct
                ? 'border-green-500 bg-green-50'
                : 'border-red-500 bg-red-50'
              : 'border-gray-300 bg-white focus:border-purple-500'
          }`}
        />
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={submit}
          aria-disabled={!answered && !value.trim()}
          className={`mt-2 block w-full min-h-[52px] font-bold rounded-xl transition-colors ${
            answered || value.trim() ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-400'
          }`}
        >
          {answered ? 'Next →' : 'Check'}
        </button>
      </div>
    </div>
  );
}
