import { ExportSettings } from '../config/types';
import { Part } from '../geometry/panel';
import { bounds, Polygon, translate } from '../geometry/path';

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

/** Simple shelf packing: tallest parts first, filled left to right in rows. */
export function layoutParts(parts: Part[], settings: ExportSettings): Sheet {
  const gap = settings.spacing;
  const items = parts
    .map((part) => ({ part, b: bounds([part.outline]) }))
    .sort((p, q) => q.b.maxY - q.b.minY - (p.b.maxY - p.b.minY));
  const placed: PlacedPart[] = [];
  let x = gap;
  let y = gap;
  let rowHeight = 0;
  let width = 0;
  for (const { part, b } of items) {
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    if (x > gap && x + w + gap > settings.sheetWidth) {
      x = gap;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    placed.push({ part, dx: x - b.minX, dy: y - b.minY });
    x += w + gap;
    rowHeight = Math.max(rowHeight, h);
    width = Math.max(width, x);
  }
  return { placed, width: Math.max(width, gap * 2), height: y + rowHeight + gap };
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
 * A text label centred on the part's bounding box, sized to fit inside it and
 * rotated a quarter turn for parts that are taller than wide.
 */
function labelText({ part, dx, dy }: PlacedPart): string {
  const b = bounds([part.outline]);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const vertical = h > w;
  const along = (vertical ? h : w) * 0.8;
  const across = (vertical ? w : h) * 0.5;
  const size = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, across, along / (part.name.length * CHAR_WIDTH)));
  const cx = (b.minX + b.maxX) / 2 + dx;
  const cy = (b.minY + b.maxY) / 2 + dy;
  // Shift the baseline down by roughly half the cap height to centre the text
  // vertically; dominant-baseline is not honoured by all laser software.
  const transform = vertical ? ` transform="rotate(-90 ${fmt(cx)} ${fmt(cy)})"` : '';
  return `  <text x="${fmt(cx)}" y="${fmt(cy + size * 0.35)}" font-size="${fmt(size)}"${transform}>${escapeXml(part.name)}</text>`;
}

/**
 * Serializes the sheet as an SVG in millimetres with two Inkscape layers: red
 * hairline cut paths and blue part-name labels (for engraving, or to hide).
 */
export function sheetToSvg(sheet: Sheet): string {
  const groups = sheet.placed.map(({ part, dx, dy }) => {
    const polys = [part.outline, ...part.holes].map((p) => translate(p, dx, dy));
    const d = polys.map(pathData).join(' ');
    return `  <g>\n    <title>${escapeXml(part.name)}</title>\n    <path d="${d}"/>\n  </g>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${fmt(sheet.width)}mm" height="${fmt(sheet.height)}mm" viewBox="0 0 ${fmt(sheet.width)} ${fmt(sheet.height)}">`,
    '<g id="cut" inkscape:groupmode="layer" inkscape:label="Cut" fill="none" stroke="#ff0000" stroke-width="0.1">',
    ...groups,
    '</g>',
    '<g id="labels" inkscape:groupmode="layer" inkscape:label="Labels" fill="#0000ff" stroke="none" font-family="sans-serif" text-anchor="middle">',
    ...sheet.placed.map(labelText),
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}
