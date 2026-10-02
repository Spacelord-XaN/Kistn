/**
 * Parses a WPF-style star definition list such as "1*, 2*, *".
 * Only star sizes are supported. Throws with a readable message on bad input.
 */
export function parseStars(text: string): number[] {
  const parts = text.split(',').map((p) => p.trim());
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    throw new Error('Definition list is empty');
  }
  return parts.map((p) => {
    const m = /^(\d*\.?\d*)\s*\*$/.exec(p);
    if (!m) throw new Error(`"${p}" is not a star size (use e.g. "1*", "2*", "*")`);
    const weight = m[1] === '' ? 1 : Number(m[1]);
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error(`"${p}" must have a positive weight`);
    }
    return weight;
  });
}

/** Splits `total` proportionally to the star weights. */
export function splitStars(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (total * w) / sum);
}

export interface Span {
  start: number;
  end: number;
}

/**
 * Lays out cells along one axis: `outer` total size, walls of `wall` at both
 * ends and dividers of `gap` between cells. Stars split the remaining space.
 */
export function layoutAxis(weights: number[], outer: number, wall: number, gap: number): Span[] {
  const usable = outer - 2 * wall - (weights.length - 1) * gap;
  const sizes = splitStars(weights, usable);
  const spans: Span[] = [];
  let pos = wall;
  for (const s of sizes) {
    spans.push({ start: pos, end: pos + s });
    pos += s + gap;
  }
  return spans;
}
