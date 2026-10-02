import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config/parse';
import { EXAMPLE_XML } from '../src/example';
import { applyKerf } from '../src/export/kerf';
import { layoutParts, sheetToSvg } from '../src/export/svg';
import { fingerCount, fingerSegments, tabIntervals } from '../src/geometry/fingers';
import { rect, signedArea } from '../src/geometry/path';
import { generateFromConfig } from '../src/generate';
import { compartmentGeometry } from '../src/parts/compartments';
import { notchFeature } from '../src/parts/drawer';
import { domParser, partArea, sumArea } from './helpers';

const exampleConfig = (kerf = 0) => {
  const config = parseConfig(EXAMPLE_XML, domParser()).config!;
  config.material.kerf = kerf;
  return config;
};

describe('fingers', () => {
  it('always uses an odd finger count', () => {
    for (let len = 5; len < 400; len += 7.3) expect(fingerCount(len, 10) % 2).toBe(1);
  });

  it('mating edges are complementary', () => {
    const high = fingerSegments(3, 197, 10, true, 3);
    const low = fingerSegments(3, 197, 10, false, 3);
    expect(high.length).toBe(low.length);
    high.forEach((h, i) => {
      expect(low[i].a).toBeCloseTo(h.a);
      expect(low[i].b).toBeCloseTo(h.b);
      expect(h.depth + low[i].depth).toBe(3);
    });
    expect(high[0].depth).toBe(0);
    expect(high[high.length - 1].depth).toBe(0);
  });

  it('staggered tabs from both sides never overlap', () => {
    const even = tabIntervals(0, 247, 10, 'even');
    const odd = tabIntervals(0, 247, 10, 'odd');
    expect(even.length).toBeGreaterThan(0);
    expect(odd.length).toBe(even.length);
    for (const [a, b] of even) for (const [c, d] of odd) expect(b <= c || d <= a).toBe(true);
  });
});

describe('volume conservation', () => {
  // If every finger, corner cube, tab and slot lines up, the summed part
  // areas × thickness equal the solid volume of the assembled object.
  it('cabinet shell + dividers', () => {
    const result = generateFromConfig(exampleConfig());
    expect(result.errors).toEqual([]);
    const { width: W, height: H, depth: D } = result.config!;
    const { t, innerDepth: dd, shelves, verticals } = result.layout!;
    const parts = result.parts!.filter((p) => /^(Cabinet|Shelf|Divider)/.test(p.name));
    const shell = W * H * D - (W - 2 * t) * (H - 2 * t) * (D - t);
    const dividers =
      shelves.reduce((s, sh) => s + (sh.x1 - sh.x0) * dd, 0) + verticals.reduce((s, v) => s + (v.y1 - v.y0) * dd, 0);
    expect(sumArea(parts) * t).toBeCloseTo(shell + dividers * t, 3);
  });

  it('every drawer box, including notch and compartments', () => {
    const result = generateFromConfig(exampleConfig());
    const dt = result.config!.material.drawerThickness;
    for (const box of result.boxes!) {
      const { width: w, height: h, depth: d } = box;
      const parts = result.parts!.filter((p) => p.name.startsWith(box.name + ' '));
      const def = box.opening.def;
      const notch = notchFeature(w, def.notchWidth, def.notchDepth).map(([x, y]) => ({ x, y }));
      let expected = (w * h * d - (w - 2 * dt) * (h - dt) * (d - 2 * dt)) / dt - Math.abs(signedArea(notch));
      const g = compartmentGeometry(result.config!, box);
      if (g) {
        const nc = g.cols.length - 1;
        const nr = g.rows.length - 1;
        expected += nc * (d - 2 * dt) * g.height + nr * (w - 2 * dt) * g.height - nc * nr * dt * g.height;
      }
      expect(sumArea(parts)).toBeCloseTo(expected, 3);
    }
  });
});

describe('drawers', () => {
  it('are the opening minus clearance', () => {
    const result = generateFromConfig(exampleConfig());
    const c = result.config!.material.clearance;
    for (const b of result.boxes!) {
      expect(b.width).toBeCloseTo(b.opening.x1 - b.opening.x0 - 2 * c);
      expect(b.height).toBeCloseTo(b.opening.y1 - b.opening.y0 - 2 * c);
      expect(b.depth).toBeCloseTo(result.layout!.innerDepth - c);
    }
  });

  it('produces five panels plus compartment dividers', () => {
    const result = generateFromConfig(exampleConfig());
    const wide = result.boxes!.find((b) => b.opening.def.colSpan === 2)!;
    expect(result.parts!.filter((p) => p.name.startsWith(wide.name + ' '))).toHaveLength(5 + 2);
  });
});

describe('kerf', () => {
  it('grows outlines and shrinks holes by kerf/2', () => {
    const part = { name: 'p', outline: rect(0, 0, 10, 10), holes: [rect(2, 2, 4, 4)] };
    const k = applyKerf(part, 0.2);
    expect(Math.abs(signedArea(k.outline))).toBeCloseTo(10.2 * 10.2);
    expect(Math.abs(signedArea(k.holes[0]))).toBeCloseTo(1.8 * 1.8);
    expect(partArea(k)).toBeCloseTo(10.2 * 10.2 - 1.8 * 1.8);
  });

  it('is applied to cut parts', () => {
    const result = generateFromConfig(exampleConfig(0.2));
    const nominal = result.parts!.find((p) => p.name === 'Cabinet Back')!;
    const cut = result.cutParts!.find((p) => p.name === 'Cabinet Back')!;
    expect(partArea(cut)).toBeGreaterThan(partArea(nominal));
  });
});

describe('svg export', () => {
  it('places every part on the sheet in millimetres', () => {
    const result = generateFromConfig(exampleConfig());
    const sheet = layoutParts(result.cutParts!, result.config!.export);
    expect(sheet.placed).toHaveLength(result.cutParts!.length);
    const svg = sheetToSvg(sheet);
    expect(svg).toMatch(/width="[\d.]+mm"/);
    expect(svg.match(/<path /g)).toHaveLength(result.cutParts!.length);
    expect(svg).toContain('inkscape:label="Labels"');
    expect(svg.match(/<text /g)).toHaveLength(result.cutParts!.length);
    expect(svg).toContain('>Cabinet Back</text>');
    for (const { part, dx, dy } of sheet.placed) {
      for (const p of part.outline) {
        expect(p.x + dx).toBeGreaterThanOrEqual(0);
        expect(p.y + dy).toBeGreaterThanOrEqual(0);
        expect(p.x + dx).toBeLessThanOrEqual(sheet.width);
      }
    }
  });
});
