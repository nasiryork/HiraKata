// One red -> yellow -> green scale for every accuracy or speed number in the app.
// hue = pct * 1.2 (0 red, 60 yellow, 120 green). Lightness stays low enough to read on white;
// the number is always shown next to the color, so color is never the only signal.
const clamp = (x) => Math.max(0, Math.min(1, x));

export const accColor = (frac) => `hsl(${Math.round(clamp(frac) * 120)} 75% 33%)`;
export const accFill = (frac) => `hsl(${Math.round(clamp(frac) * 120)} 70% 45%)`;

// Speed against a cutoff: at or under half the cutoff is green, at the cutoff yellow, at 1.5x red.
export const speedFrac = (ms, cutoff) => (ms == null ? null : clamp(1.5 - ms / cutoff));
