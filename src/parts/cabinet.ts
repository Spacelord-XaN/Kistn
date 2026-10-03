import { tabIntervals } from '../geometry/fingers';
import { EdgeSpec, buildPanel, Part } from '../geometry/panel';
import { Polygon, rect } from '../geometry/path';
import { CabinetLayout } from '../layout/grid';

/*
 * Corner-cube priority: sides > top/bottom > back. The higher-priority panel
 * owns the fingers at the ends of each jointed edge and the shared corner cubes.
 */

export function cabinetParts(layout: CabinetLayout): Part[] {
  const { config, t, innerDepth: dd, shelves, verticals } = layout;
  const { width: W, height: H, depth: D } = config;
  const fw = config.material.fingerWidth;
  const finger = (high: boolean): EdgeSpec => ({ kind: 'finger', high, depth: t, fingerWidth: fw });
  const plain: EdgeSpec = { kind: 'plain' };

  // Slots for shelves ending at a side wall. Side frame: x = z (front→back), y = y.
  const sideSlots = (end: 'leftEnd' | 'rightEnd'): Polygon[] =>
    shelves
      .filter((s) => s[end] === 'wall')
      .flatMap((s) => tabIntervals(0, dd, fw, 'all').map(([a, b]) => rect(a, s.y, b, s.y + t)));

  // Slots for verticals ending at the top/bottom. Frame: x = x, y = z.
  const capSlots = (end: 'topEnd' | 'bottomEnd'): Polygon[] =>
    verticals
      .filter((v) => v[end] === 'wall')
      .flatMap((v) => tabIntervals(0, dd, fw, 'all').map(([a, b]) => rect(v.x, a, v.x + t, b)));

  // Back frame: x = x, y = y.
  const backSlots: Polygon[] = [
    ...shelves.flatMap((s) => tabIntervals(s.x0, s.x1, fw, 'all').map(([a, b]) => rect(a, s.y, b, s.y + t))),
    ...verticals.flatMap((v) => tabIntervals(v.y0, v.y1, fw, 'all').map(([a, b]) => rect(v.x, a, v.x + t, b))),
  ];

  const side = (name: string, label: string, holes: Polygon[]) =>
    buildPanel(name, label, {
      width: D,
      height: H,
      // top, back, bottom, front(open)
      edges: [finger(true), finger(true), finger(true), plain],
      ownedCorners: [false, true, true, false],
      holes,
    });

  const cap = (name: string, label: string, holes: Polygon[]) =>
    buildPanel(name, label, {
      width: W,
      height: D,
      // front(open), right side, back, left side
      edges: [plain, finger(false), finger(true), finger(false)],
      holes,
    });

  return [
    buildPanel('Cabinet Back', 'C-B', {
      width: W,
      height: H,
      edges: [finger(false), finger(false), finger(false), finger(false)],
      holes: backSlots,
    }),
    side('Cabinet Left', 'C-L', sideSlots('leftEnd')),
    side('Cabinet Right', 'C-R', sideSlots('rightEnd')),
    cap('Cabinet Top', 'C-T', capSlots('topEnd')),
    cap('Cabinet Bottom', 'C-U', capSlots('bottomEnd')),
  ];
}
