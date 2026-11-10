// Slider -> token-string formatters (see typography-controls.test.ts).

// Rounds to a fixed decimal count so slider float drift (e.g. 0.05 * 6 =
// 0.30000000000000004) can never produce a string core's grammar/length bound
// would reject.
export function formatRadius(rem: number): string {
  return `${Math.round(rem * 100) / 100}rem`;
}

export function formatLetterSpacing(em: number): string {
  return `${Math.round(em * 1000) / 1000}em`;
}

export function parseUnitValue(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}
