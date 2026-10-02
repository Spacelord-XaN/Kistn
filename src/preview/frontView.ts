import { CabinetLayout } from '../layout/grid';
import { DrawerBox, notchFeature } from '../parts/drawer';

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

/** Horizontal dimension line with end ticks and a centred label above it. */
function hDim(x0: number, x1: number, y: number, label: string, fs: number): string {
  const tick = fs * 0.4;
  return `<g class="dim">
    <line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>
    <line x1="${x0}" y1="${y - tick}" x2="${x0}" y2="${y + tick}"/>
    <line x1="${x1}" y1="${y - tick}" x2="${x1}" y2="${y + tick}"/>
    <text x="${(x0 + x1) / 2}" y="${y - fs * 0.35}" font-size="${fs}" text-anchor="middle">${label}</text>
  </g>`;
}

/** Vertical dimension line with a rotated label left of it. */
function vDim(y0: number, y1: number, x: number, label: string, fs: number): string {
  const tick = fs * 0.4;
  const cy = (y0 + y1) / 2;
  const tx = x - fs * 0.35;
  return `<g class="dim">
    <line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}"/>
    <line x1="${x - tick}" y1="${y0}" x2="${x + tick}" y2="${y0}"/>
    <line x1="${x - tick}" y1="${y1}" x2="${x + tick}" y2="${y1}"/>
    <text x="${tx}" y="${cy}" font-size="${fs}" text-anchor="middle" transform="rotate(-90 ${tx} ${cy})">${label}</text>
  </g>`;
}

function drawerFront(box: DrawerBox, clearance: number): string {
  const x0 = box.opening.x0 + clearance;
  const y0 = box.opening.y0 + clearance;
  const def = box.opening.def;
  const pts: [number, number][] = [[0, 0]];
  if (def.notchWidth > 0 && def.notchDepth > 0) pts.push(...notchFeature(box.width, def.notchWidth, def.notchDepth));
  pts.push([box.width, 0], [box.width, box.height], [0, box.height]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x0 + x)} ${f1(y0 + y)}`).join(' ') + ' Z';
  return `<path class="drawer" d="${d}"/>`;
}

export function frontViewSvg(layout: CabinetLayout, boxes: DrawerBox[]): string {
  const { config, cols, rows } = layout;
  const { width: W, height: H, depth: D } = config;
  const fs = Math.max(W, H) / 45;
  const margin = fs * 4;
  const vb = `${-margin} ${-margin} ${W + margin * 2} ${H + margin * 2}`;
  const c = config.material.clearance;

  const openings = layout.drawers
    .map((o) => `<rect class="opening" x="${o.x0}" y="${o.y0}" width="${o.x1 - o.x0}" height="${o.y1 - o.y0}"/>`)
    .join('');

  const fronts = boxes
    .map((b) => {
      const cx = (b.opening.x0 + b.opening.x1) / 2;
      const cy = (b.opening.y0 + b.opening.y1) / 2;
      const comp = b.opening.def.compartments;
      const dfs = Math.min(fs * 0.8, (b.width / 10) * 0.9);
      const lines = [`${f1(b.width)} × ${f1(b.height)} × ${f1(b.depth)}`];
      if (comp) lines.push(`${comp.cols.length} × ${comp.rows.length} compartments`);
      const notchDepth = b.opening.def.notchWidth > 0 ? b.opening.def.notchDepth : 0;
      const ty = Math.max(cy, b.opening.y0 + c + notchDepth + dfs * 1.2);
      const text = lines
        .map(
          (l, i) =>
            `<text class="label" x="${cx}" y="${ty + i * dfs * 1.25}" font-size="${dfs}" text-anchor="middle">${l}</text>`,
        )
        .join('');
      return drawerFront(b, c) + text;
    })
    .join('');

  const colDims = cols.map((s) => hDim(s.start, s.end, H + fs * 1.6, f1(s.end - s.start), fs * 0.75)).join('');
  const rowDims = rows
    .map((s) => vDim(s.start, s.end, W + fs * 2.2, f1(s.end - s.start), fs * 0.75))
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="front-view">
  <rect class="wall" x="0" y="0" width="${W}" height="${H}"/>
  ${openings}
  ${fronts}
  ${hDim(0, W, -fs * 1.2, `${f1(W)} mm`, fs)}
  ${vDim(0, H, -fs * 1.2, `${f1(H)} mm`, fs)}
  ${colDims}
  ${rowDims}
  <text class="caption" x="${W / 2}" y="${H + fs * 3.6}" font-size="${fs * 0.8}" text-anchor="middle">Depth ${f1(D)} mm · drawer sizes W × H × D</text>
</svg>`;
}
