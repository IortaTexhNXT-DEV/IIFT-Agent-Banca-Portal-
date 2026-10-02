/**
 * Name similarity used by the built-in watch-list screening. Names are normalised
 * (case, punctuation, honorifics) and compared token by token with Jaro-Winkler,
 * which tolerates transliteration differences common in Malay and Arabic names
 * (e.g. "Mohd" / "Mohammad", "Abdul Rahman" / "Abdulrahman").
 */

const HONORIFICS = new Set([
  'DATO',
  'DATIN',
  'DR',
  'HAJI',
  'HAJAH',
  'HJ',
  'HJH',
  'MR',
  'MRS',
  'MS',
  'MISS',
  'PENGIRAN',
  'PG',
  'AWANG',
  'DAYANG',
  'DK',
  'AWG',
  'DYG',
]);
const ALIASES: Record<string, string> = {
  MOHD: 'MUHAMMAD',
  MOHAMMAD: 'MUHAMMAD',
  MOHAMED: 'MUHAMMAD',
  MUHAMAD: 'MUHAMMAD',
  MD: 'MUHAMMAD',
  ABD: 'ABDUL',
};

export function normaliseName(name: string): string {
  return tokens(name).join(' ');
}

function tokens(name: string): string[] {
  return name
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0 && !HONORIFICS.has(token))
    .map((token) => ALIASES[token] ?? token);
}

/** 0–100 similarity between two person/company names. */
export function nameSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  const total = shorter.reduce(
    (acc, token) => acc + Math.max(...longer.map((candidate) => jaroWinkler(token, candidate))),
    0,
  );
  // Penalise when the longer name has many unmatched tokens.
  const coverage = shorter.length / longer.length;
  return Math.round((total / shorter.length) * (0.85 + 0.15 * coverage) * 100);
}

export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) {
    return 1;
  }
  const matchDistance = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);
  const s1Matches = Array.from({ length: s1.length }, () => false);
  const s2Matches = Array.from({ length: s2.length }, () => false);
  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
  }
  if (matches === 0) {
    return 0;
  }
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, s1.length, s2.length) && s1[prefix] === s2[prefix]) {
    prefix++;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}
