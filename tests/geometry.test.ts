import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config/parse';
import { EXAMPLE_XML } from '../src/example';
import { applyKerf } from '../src/export/kerf';
import { layoutParts, sheetToSvg } from '../src/export/svg';
import { fingerCount, fingerSegments, tabIntervals } from '../src/geometry/fingers';
import { rect, signedArea } from '../src/geometry/path';
import { generateFromConfig } from '../src/generate';
import { compartmentGeometry } from '../src/parts/compartments';
import { handleHole, innerSize, innerVolume } from '../src/parts/drawer';
import { formatLiters, frontViewSvg } from '../src/preview/frontView';
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

  it('every drawer box, including handle hole and compartments', () => {
    const result = generateFromConfig(exampleConfig());
    const dt = result.config!.material.drawerThickness;
    for (const box of result.boxes!) {
      const { width: w, height: h, depth: d } = box;
      const parts = result.parts!.filter((p) => p.name.startsWith(box.name + ' '));
      const hole = handleHole(box);
      let expected = (w * h * d - (w - 2 * dt) * (h - dt) * (d - 2 * dt)) / dt - (hole ? Math.abs(signedArea(hole)) : 0);
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

  it('reports the inside size in the preview when asked', () => {
    const result = generateFromConfig(exampleConfig());
    const dt = result.config!.material.drawerThickness;
    const b = result.boxes![0];
    const inner = innerSize(b, dt);
    expect(inner).toEqual({ width: b.width - 2 * dt, height: b.height - dt, depth: b.depth - 2 * dt });
    const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
    const outside = frontViewSvg(result.layout!, result.boxes!);
    const inside = frontViewSvg(result.layout!, result.boxes!, { inside: true });
    expect(outside).toContain(`${f1(b.width)} × ${f1(b.height)} × ${f1(b.depth)}`);
    expect(outside).toContain('(outside)');
    expect(inside).toContain(`${f1(inner.width)} × ${f1(inner.height)} × ${f1(inner.depth)}`);
    expect(inside).toContain('(inside)');
  });

  it('shows the inside volume in liters when asked', () => {
    const result = generateFromConfig(exampleConfig());
    const dt = result.config!.material.drawerThickness;
    const b = result.boxes![0];
    const inner = innerSize(b, dt);
    expect(innerVolume(b, dt)).toBeCloseTo((inner.width * inner.height * inner.depth) / 1e6);
    const label = `>${formatLiters(innerVolume(b, dt))} L<`;
    expect(frontViewSvg(result.layout!, result.boxes!, { volume: true })).toContain(label);
    expect(frontViewSvg(result.layout!, result.boxes!)).not.toContain(' L<');
  });

  it('leaves out open slots but keeps their shelves and dividers', () => {
    const config = exampleConfig();
    const result = generateFromConfig(config);
    const open = result.layout!.drawers.filter((o) => !o.def.drawer);
    expect(open).toHaveLength(1);
    expect(result.boxes).toHaveLength(result.layout!.drawers.length - 1);
    expect(result.parts!.some((p) => p.label.startsWith('D2.2'))).toBe(false);

    const allDrawers = generateFromConfig({
      ...config,
      drawers: config.drawers.map((d) => ({ ...d, drawer: true })),
    });
    expect(result.layout!.shelves).toEqual(allDrawers.layout!.shelves);
    expect(result.layout!.verticals).toEqual(allDrawers.layout!.verticals);
  });

  it('produces only cabinet and divider parts without any drawers', () => {
    const config = exampleConfig();
    const result = generateFromConfig({ ...config, drawers: config.drawers.map((d) => ({ ...d, drawer: false })) });
    expect(result.errors).toEqual([]);
    expect(result.boxes).toEqual([]);
    expect(result.parts!.every((p) => !p.label.startsWith('D'))).toBe(true);
    expect(result.cutGroups).toHaveLength(2);
  });
});

describe('handle hole', () => {
  it('is cut into drawer fronts only, centred horizontally at the offset', () => {
    const result = generateFromConfig(exampleConfig());
    for (const box of result.boxes!) {
      const front = result.parts!.find((p) => p.name === `${box.name} Front`)!;
      const back = result.parts!.find((p) => p.name === `${box.name} Back`)!;
      expect(front.holes).toHaveLength(1);
      expect(back.holes).toHaveLength(0);
      const xs = front.holes[0].map((p) => p.x);
      const ys = front.holes[0].map((p) => p.y);
      const { width, height, offset } = box.opening.def.handle!;
      expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(box.width / 2);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(width);
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(height);
      expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(offset!);
    }
  });

  it('puts the front label outside the hole', () => {
    const result = generateFromConfig(exampleConfig());
    for (const p of result.parts!.filter((p) => p.label.endsWith('-F'))) {
      const holeBottom = Math.max(...p.holes[0].map((q) => q.y));
      expect(p.labelBox!.minY).toBeGreaterThanOrEqual(holeBottom);
    }
  });

  it('reports a handle that does not fit the front', () => {
    const config = exampleConfig();
    config.drawers[0].handle = { shape: 'rectangle', width: 1000, height: 20 };
    const result = generateFromConfig(config);
    expect(result.errors.join('\n')).toMatch(/handle \(1000 × 20 mm\) does not fit the front/);
  });
});

describe('kerf', () => {
  it('grows outlines and shrinks holes by kerf/2', () => {
    const part = { name: 'p', label: 'p', outline: rect(0, 0, 10, 10), holes: [rect(2, 2, 4, 4)] };
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
    const front = (parts: typeof result.parts) => parts!.find((p) => p.label === 'D0.0-F')!;
    expect(Math.abs(signedArea(front(result.cutParts).holes[0]))).toBeLessThan(
      Math.abs(signedArea(front(result.parts).holes[0])),
    );
  });
});

describe('svg export', () => {
  it('lays out every part in millimetres, one row per assembly', () => {
    const result = generateFromConfig(exampleConfig());
    const sheet = layoutParts(result.cutGroups!, result.config!.export.spacing);
    expect(sheet.placed).toHaveLength(result.cutParts!.length);
    const svg = sheetToSvg(sheet, result.layout!, result.boxes!);
    expect(svg).toMatch(/width="[\d.]+mm"/);
    expect(svg.match(/<path /g)).toHaveLength(result.cutParts!.length);
    expect(svg).toContain('inkscape:label="Labels"');
    for (const label of ['C-B', 'D0.0-F', 'D0.0-CD1', 'S1', 'V1', 'D0.0', 'C  Cabinet']) {
      expect(svg).toContain(`>${label}</text>`);
    }
    for (const { part, dx, dy } of sheet.placed) {
      for (const p of part.outline) {
        expect(p.x + dx).toBeGreaterThanOrEqual(0);
        expect(p.y + dy).toBeGreaterThanOrEqual(0);
        expect(p.x + dx).toBeLessThanOrEqual(sheet.width);
        expect(p.y + dy).toBeLessThanOrEqual(sheet.height);
      }
    }
  });

  it('gives every part a unique short label', () => {
    const labels = generateFromConfig(exampleConfig()).parts!.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
