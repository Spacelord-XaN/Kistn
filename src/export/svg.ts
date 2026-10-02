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

/** Serializes the sheet as an SVG in millimetres with red hairline cut paths. */
export function sheetToSvg(sheet: Sheet): string {
  const groups = sheet.placed.map(({ part, dx, dy }) => {
    const polys = [part.outline, ...part.holes].map((p) => translate(p, dx, dy));
    const d = polys.map(pathData).join(' ');
    return `  <g>\n    <title>${escapeXml(part.name)}</title>\n    <path d="${d}"/>\n  </g>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(sheet.width)}mm" height="${fmt(sheet.height)}mm" viewBox="0 0 ${fmt(sheet.width)} ${fmt(sheet.height)}">`,
    '<g fill="none" stroke="#ff0000" stroke-width="0.1">',
    ...groups,
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}
