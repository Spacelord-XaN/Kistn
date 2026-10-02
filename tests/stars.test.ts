import { describe, expect, it } from 'vitest';
import { layoutAxis, parseStars, splitStars } from '../src/layout/stars';

describe('parseStars', () => {
  it('parses star weights', () => {
    expect(parseStars('1*, 2*,*, 0.5*')).toEqual([1, 2, 1, 0.5]);
  });

  it('treats plain numbers as star weights', () => {
    expect(parseStars('1, 2, 0.5')).toEqual([1, 2, 0.5]);
    expect(parseStars('100, 1*')).toEqual([100, 1]);
  });

  it('rejects non-star sizes', () => {
    expect(() => parseStars('Auto')).toThrow(/not a star size/);
    expect(() => parseStars('1,,2')).toThrow(/not a star size/);
    expect(() => parseStars('0*')).toThrow(/positive/);
    expect(() => parseStars('0')).toThrow(/positive/);
    expect(() => parseStars('.')).toThrow(/positive/);
    expect(() => parseStars('')).toThrow(/empty/);
  });
});

describe('splitStars / layoutAxis', () => {
  it('splits proportionally and sums to the total', () => {
    const sizes = splitStars([1, 2, 1], 200);
    expect(sizes).toEqual([50, 100, 50]);
  });

  it('splits only the usable space after walls and dividers', () => {
    // 100 outer, 3 mm walls, two 3 mm dividers → 100 − 6 − 6 = 88 usable.
    const spans = layoutAxis([1, 1, 2], 100, 3, 3);
    expect(spans[0]).toEqual({ start: 3, end: 25 });
    expect(spans[1]).toEqual({ start: 28, end: 50 });
    expect(spans[2]).toEqual({ start: 53, end: 97 });
  });
});
