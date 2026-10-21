// Forgiving romaji compare for typed answers. Both sides go through the same normalisation, so
// "ou"/"oo"/"ō", "n"/"nn", and Kunrei spellings (si, tu, ti, hu, zi, sya...) all match Hepburn.
const KUNREI = [
  [/sy([aiueo])/g, 'sh$1'],
  [/ty([aiueo])/g, 'ch$1'],
  [/(?:zy|jy)([aiueo])/g, 'j$1'],
  [/si/g, 'shi'],
  [/ti/g, 'chi'],
  [/tu/g, 'tsu'],
  [/hu/g, 'fu'],
  [/zi/g, 'ji'],
  [/di/g, 'ji'],
  [/du/g, 'zu'],
];

export function normRomaji(s) {
  let t = String(s)
    .toLowerCase()
    .normalize('NFC')
    .replace(/ō/g, 'ou')
    .replace(/ū/g, 'uu')
    .replace(/ā/g, 'aa')
    .replace(/ī/g, 'ii')
    .replace(/ē/g, 'ee')
    .replace(/[\s\-'’.,!?/]/g, '');
  for (const [re, to] of KUNREI) t = t.replace(re, to);
  return t
    .replace(/nn/g, 'n')
    .replace(/ou|oo/g, 'o')
    .replace(/uu/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'e')
    .replace(/ii/g, 'i');
}

export const sameRomaji = (typed, answer) => normRomaji(typed) === normRomaji(answer);
