/**
 * Tiny statistical helpers shared across drift + cycle computations.
 * Median is the right choice in both contexts: a single field reset
 * (concrete settling, e-stop) can throw a 30+ min outlier into the sample.
 */

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
