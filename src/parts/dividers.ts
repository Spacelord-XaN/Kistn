import { TabParity, tabIntervals } from '../geometry/fingers';
import { buildPanel, Feature, Part, rectFeature } from '../geometry/panel';
import { rect } from '../geometry/path';
import { CabinetLayout, EndKind } from '../layout/grid';

/*
 * Shelves run through column gaps; verticals end on them. A vertical above a
 * shelf uses the 'even' tab positions, one below it the 'odd' ones, so both
 * can share the shelf at the same x without their tabs colliding.
 */

const ABOVE: TabParity = 'even';
const BELOW: TabParity = 'odd';

export function dividerParts(layout: CabinetLayout): Part[] {
  const { config, t, innerDepth: dd, shelves, verticals } = layout;
  const fw = config.material.fingerWidth;
  const tabs = (start: number, end: number, parity: TabParity, shift = 0): Feature[] =>
    tabIntervals(start, end, fw, parity).map(([a, b]) => rectFeature(a - shift, b - shift, -t));

  const parts: Part[] = [];

  // Shelf frame: x = x − x0 (left→right), y = z (front→back).
  shelves.forEach((s, i) => {
    const length = s.x1 - s.x0;
    const holes = verticals.flatMap((v) => {
      const parity = v.bottomShelf === i ? ABOVE : v.topShelf === i ? BELOW : undefined;
      if (!parity) return [];
      return tabIntervals(0, dd, fw, parity).map(([a, b]) => rect(v.x - s.x0, a, v.x - s.x0 + t, b));
    });
    parts.push(
      buildPanel(`Shelf ${i + 1} (below row ${s.boundary}, columns ${s.colStart}–${s.colEnd})`, {
        width: length,
        height: dd,
        edges: [
          { kind: 'plain' },
          { kind: 'plain', features: tabs(0, dd, 'all') },
          { kind: 'plain', features: tabs(s.x0, s.x1, 'all', s.x0) },
          { kind: 'plain', features: tabs(0, dd, 'all') },
        ],
        holes,
      }),
    );
  });

  // Vertical frame: x = z (front→back), y = y − y0 (top→bottom).
  verticals.forEach((v, i) => {
    const length = v.y1 - v.y0;
    const endTabs = (end: EndKind, onShelfParity: TabParity) => tabs(0, dd, end === 'wall' ? 'all' : onShelfParity);
    const holes = shelves
      .filter((s) => s.leftVertical === i || s.rightVertical === i)
      .flatMap((s) => tabIntervals(0, dd, fw, 'all').map(([a, b]) => rect(a, s.y - v.y0, b, s.y - v.y0 + t)));
    parts.push(
      buildPanel(`Divider ${i + 1} (right of column ${v.gap}, rows ${v.rowStart}–${v.rowEnd})`, {
        width: dd,
        height: length,
        edges: [
          // The top end sits below a shelf, the bottom end above one.
          { kind: 'plain', features: endTabs(v.topEnd, BELOW) },
          { kind: 'plain', features: tabs(v.y0, v.y1, 'all', v.y0) },
          { kind: 'plain', features: endTabs(v.bottomEnd, ABOVE) },
          { kind: 'plain' },
        ],
        holes,
      }),
    );
  });

  return parts;
}
