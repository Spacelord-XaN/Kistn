import { Part } from '../geometry/panel';
import { Bounds, bounds, Polygon, translate } from '../geometry/path';
import { CabinetLayout } from '../layout/grid';
import { DrawerBox } from '../parts/drawer';

export interface PlacedPart {
  part: Part;
  /** Offset applied to the part's own coordinates. */
  dx: number;
  dy: number;
}

export interface Sheet {
  placed: PlacedPart[];
  width: number;
  height: number;
}

/**
 * Lays out each group (an assembly such as one drawer) in its own row, parts
 * left to right. Arranging them on material is left to the laser software.
 */
export function layoutParts(groups: Part[][], spacing: number): Sheet {
  const gap = spacing;
  const placed: PlacedPart[] = [];
  let y = gap;
  let width = gap * 2;
  for (const group of groups.filter((g) => g.length)) {
    let x = gap;
    let rowHeight = 0;
    for (const part of group) {
      const b = bounds([part.outline]);
      placed.push({ part, dx: x - b.minX, dy: y - b.minY });
      x += b.maxX - b.minX + gap;
      rowHeight = Math.max(rowHeight, b.maxY - b.minY);
    }
    width = Math.max(width, x);
    y += rowHeight + gap;
  }
  return { placed, width, height: Math.max(y, gap * 2) };
}

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

function pathData(poly: Polygon): string {
  return poly.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join(' ') + ' Z';
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
}

/** Approximate advance width of a glyph relative to the font size. */
const CHAR_WIDTH = 0.6;
const MAX_FONT_SIZE = 6;
const MIN_FONT_SIZE = 1.5;

/**
 * A text label centred on the box, sized to fit inside it and rotated a
 * quarter turn for boxes that are taller than wide.
 */
function fitText(text: string, b: Bounds): string {
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const vertical = h > w;
  const along = (vertical ? h : w) * 0.8;
  const across = (vertical ? w : h) * 0.5;
  const size = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, across, along / (text.length * CHAR_WIDTH)));
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  // Shift the baseline down by roughly half the cap height to centre the text
  // vertically; dominant-baseline is not honoured by all laser software.
  const transform = vertical ? ` transform="rotate(-90 ${fmt(cx)} ${fmt(cy)})"` : '';
  return `  <text x="${fmt(cx)}" y="${fmt(cy + size * 0.35)}" font-size="${fmt(size)}"${transform}>${escapeXml(text)}</text>`;
}

function labelText({ part, dx, dy }: PlacedPart): string {
  const b = part.labelBox ?? bounds([part.outline]);
  return fitText(part.label, { minX: b.minX + dx, maxX: b.maxX + dx, minY: b.minY + dy, maxY: b.maxY + dy });
}

/** Maximum width of the front view in the overview (mm). */
const FRONT_VIEW_WIDTH = 150;
const LEGEND_FONT_SIZE = 4;
const LEGEND = [
  'C  Cabinet',
  'S  Shelf',
  'V  Divider',
  'D<row>.<column>  Drawer',
  'CD  Compartment divider',
  '',
  'F front · B back',
  'L left · R right',
  'T top · U bottom',
];

/**
 * Scaled front view marking each drawer, shelf and divider with its code,
 * plus a legend of the codes, with its top-left corner at (x, y).
 */
function overview(layout: CabinetLayout, boxes: DrawerBox[], x: number, y: number) {
  const { config, t } = layout;
  const s = Math.min(1, FRONT_VIEW_WIDTH / config.width);
  const box = (x0: number, y0: number, x1: number, y1: number): Bounds => ({
    minX: x + x0 * s,
    minY: y + y0 * s,
    maxX: x + x1 * s,
    maxY: y + y1 * s,
  });
  const rect = (b: Bounds) =>
    `  <rect x="${fmt(b.minX)}" y="${fmt(b.minY)}" width="${fmt(b.maxX - b.minX)}" height="${fmt(b.maxY - b.minY)}"/>`;

  const pieces: [string, Bounds][] = [
    ...layout.shelves.map((sh, i): [string, Bounds] => [`S${i + 1}`, box(sh.x0, sh.y, sh.x1, sh.y + t)]),
    ...layout.verticals.map((v, i): [string, Bounds] => [`V${i + 1}`, box(v.x, v.y0, v.x + t, v.y1)]),
    ...boxes.map((b): [string, Bounds] => {
      const x0 = b.opening.x0 + config.material.clearance;
      const y0 = b.opening.y0 + config.material.clearance;
      return [b.code, box(x0, y0, x0 + b.width, y0 + b.height)];
    }),
  ];

  const frontW = config.width * s;
  const frontH = config.height * s;
  const fs = LEGEND_FONT_SIZE;
  const legendX = x + frontW + fs * 2;
  const legendW = Math.max(...LEGEND.map((l) => l.length)) * CHAR_WIDTH * fs;
  const svg = [
    '  <g fill="none" stroke="#0000ff" stroke-width="0.2">',
    rect(box(0, 0, config.width, config.height)),
    ...pieces.map(([, b]) => rect(b)),
    '  </g>',
    ...pieces.map(([code, b]) => fitText(code, b)),
    '  <g text-anchor="start">',
    ...LEGEND.flatMap((l, i) =>
      l ? [`  <text x="${fmt(legendX)}" y="${fmt(y + (i + 1) * fs * 1.4)}" font-size="${fs}">${escapeXml(l)}</text>`] : [],
    ),
    '  </g>',
  ];
  return { svg, width: legendX + legendW - x, height: Math.max(frontH, LEGEND.length * fs * 1.4) };
}

/**
 * Serializes the parts as an SVG in millimetres with two Inkscape layers: red
 * hairline cut paths, and blue part codes plus an overview with a front view
 * and legend (for engraving, or to hide).
 */
export function sheetToSvg(sheet: Sheet, layout: CabinetLayout, boxes: DrawerBox[]): string {
  const margin = Math.max(layout.config.export.spacing, 10);
  const ov = overview(layout, boxes, margin, margin);
  // Parts go below the overview.
  const top = ov.height + margin;
  const placed = sheet.placed.map((p) => ({ ...p, dy: p.dy + top }));
  const width = Math.max(sheet.width, ov.width + margin * 2);
  const height = sheet.height + top;

  const groups = placed.map(({ part, dx, dy }) => {
    const polys = [part.outline, ...part.holes].map((p) => translate(p, dx, dy));
    const d = polys.map(pathData).join(' ');
    return `  <g>\n    <title>${escapeXml(part.name)}</title>\n    <path d="${d}"/>\n  </g>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${fmt(width)}mm" height="${fmt(height)}mm" viewBox="0 0 ${fmt(width)} ${fmt(height)}">`,
    '<g id="cut" inkscape:groupmode="layer" inkscape:label="Cut" fill="none" stroke="#ff0000" stroke-width="0.1">',
    ...groups,
    '</g>',
    '<g id="labels" inkscape:groupmode="layer" inkscape:label="Labels" fill="#0000ff" stroke="none" font-family="sans-serif" text-anchor="middle">',
    ...ov.svg,
    ...placed.map(labelText),
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}
