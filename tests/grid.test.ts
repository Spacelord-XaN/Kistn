import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config/parse';
import { EXAMPLE_XML } from '../src/example';
import { computeLayout } from '../src/layout/grid';
import { domParser } from './helpers';

describe('computeLayout', () => {
  // Example grid, by drawer:
  //   r0: A A C
  //   r1: B D E
  //   r2: B F G
  const layout = computeLayout(parseConfig(EXAMPLE_XML, domParser()).config!);

  it('computes openings that include spanned gaps', () => {
    const wide = layout.drawers.find((d) => d.def.colSpan === 2)!;
    expect(wide.x0).toBe(layout.cols[0].start);
    expect(wide.x1).toBe(layout.cols[1].end);
  });

  it('creates shelves only between different drawers', () => {
    expect(layout.shelves.map((s) => [s.boundary, s.colStart, s.colEnd, s.leftEnd, s.rightEnd])).toEqual([
      [0, 0, 2, 'wall', 'wall'],
      [1, 1, 2, 'divider', 'wall'],
    ]);
  });

  it('splits verticals at crossing shelves and keeps them continuous at T-junctions', () => {
    expect(layout.verticals.map((v) => [v.gap, v.rowStart, v.rowEnd, v.topEnd, v.bottomEnd])).toEqual([
      [0, 1, 2, 'divider', 'wall'],
      [1, 0, 0, 'wall', 'divider'],
      [1, 1, 1, 'divider', 'divider'],
      [1, 2, 2, 'divider', 'wall'],
    ]);
  });

  it('links pieces to what they end on', () => {
    const [v0, v1, v2, v3] = layout.verticals;
    expect(v0.topShelf).toBe(0);
    expect(v1.bottomShelf).toBe(0);
    expect([v2.topShelf, v2.bottomShelf]).toEqual([0, 1]);
    expect(v3.topShelf).toBe(1);
    // The lower shelf ends on the continuous vertical in gap 0.
    expect(layout.shelves[1].leftVertical).toBe(0);
  });
});
