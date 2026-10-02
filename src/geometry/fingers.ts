/** A run along an edge [a, b] cut to `depth` (inward > 0, outward tab < 0). */
export interface Segment {
  a: number;
  b: number;
  depth: number;
}

/** Odd finger count closest to length / target width (at least 1). */
export function fingerCount(length: number, fingerWidth: number): number {
  let n = Math.max(1, Math.round(length / fingerWidth));
  if (n % 2 === 0) n += length / n > fingerWidth ? 1 : -1;
  return Math.max(1, n);
}

/**
 * Finger pattern over [a, b]. The `high` side keeps the fingers at both ends
 * (even indices); the mating `low` side keeps the odd ones. Because the count is
 * odd the pattern is symmetric, so mating edges may run in either direction.
 */
export function fingerSegments(a: number, b: number, fingerWidth: number, high: boolean, depth: number): Segment[] {
  const n = fingerCount(b - a, fingerWidth);
  const pitch = (b - a) / n;
  const segs: Segment[] = [];
  for (let k = 0; k < n; k++) {
    const isFinger = (k % 2 === 0) === high;
    segs.push({ a: a + k * pitch, b: a + (k + 1) * pitch, depth: isFinger ? 0 : depth });
  }
  return segs;
}

export type TabParity = 'all' | 'even' | 'odd';

/**
 * Tab positions along [start, end] for a divider edge that pokes through slots.
 * Pieces meeting the same panel from opposite sides use 'even' and 'odd' so
 * their tabs never share a slot. Slots are cut with the same function.
 */
export function tabIntervals(start: number, end: number, fingerWidth: number, parity: TabParity): [number, number][] {
  const length = end - start;
  let count: number;
  if (parity === 'all') {
    count = Math.max(2, Math.round(length / (3 * fingerWidth)));
  } else {
    count = Math.max(2, Math.round(length / (1.5 * fingerWidth)));
    if (count % 2) count++;
  }
  const pitch = length / count;
  const width = Math.min(fingerWidth, pitch * 0.6);
  const result: [number, number][] = [];
  for (let k = 0; k < count; k++) {
    if (parity === 'even' && k % 2 !== 0) continue;
    if (parity === 'odd' && k % 2 !== 1) continue;
    const c = start + (k + 0.5) * pitch;
    result.push([c - width / 2, c + width / 2]);
  }
  return result;
}
