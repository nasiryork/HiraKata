import React from 'react';
import { primeKeyboard, dropKeyboard } from './TypedShell.jsx';

export const MODE_OPTIONS = [
  { id: 'choice', label: 'Choose' },
  { id: 'typed', label: 'Type' },
  { id: 'mix', label: 'Mix' },
];

// Choose / Type / Mix. Tapping Type or Mix primes the keyboard inside the tap (iOS only opens it
// for a user gesture); Choose closes it.
export default function ModeSwitch({ mode, setMode, small }) {
  return (
    <div className="flex gap-1">
      {MODE_OPTIONS.map((m) => (
        <button
          key={m.id}
          type="button"
          onPointerDown={(e) => small && e.preventDefault()}
          onClick={() => {
            if (m.id === 'choice') dropKeyboard();
            else primeKeyboard();
            setMode(m.id);
          }}
          className={`${small ? 'py-2 px-3 text-sm' : 'py-3 px-4 text-sm'} rounded-lg font-medium ${
            mode === m.id ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
