import { CabinetConfig } from '../config/types';
import { EdgeSpec, buildPanel, Part } from '../geometry/panel';
import { bounds, Polygon, rect } from '../geometry/path';
import { CabinetLayout, DrawerOpening } from '../layout/grid';
import { compartmentParts } from './compartments';

/*
 * Drawer boxes are open at the top. Corner-cube priority: sides > front/back >
 * bottom, mirroring the cabinet.
 */

export interface DrawerBox {
  opening: DrawerOpening;
  name: string;
  /** Short code, e.g. "D0.1" for row 0, column 1. */
  code: string;
  width: number;
  height: number;
  depth: number;
}

export function drawerBox(layout: CabinetLayout, opening: DrawerOpening): DrawerBox {
  const c = layout.config.material.clearance;
  const { row, col } = opening.def;
  return {
    opening,
    name: `Drawer R${row}C${col}`,
    code: `D${row}.${col}`,
    width: opening.x1 - opening.x0 - 2 * c,
    height: opening.y1 - opening.y0 - 2 * c,
    depth: layout.innerDepth - c,
  };
}

/** Usable space inside the open-topped box. */
export function innerSize(box: DrawerBox, dt: number) {
  return { width: box.width - 2 * dt, height: box.height - dt, depth: box.depth - 2 * dt };
}

/** Usable inside volume in liters. */
export function innerVolume(box: DrawerBox, dt: number): number {
  const { width, height, depth } = innerSize(box, dt);
  return (width * height * depth) / 1e6;
}

const ELLIPSE_SEGMENTS = 48;
/** Minimum material left around the handle hole (mm). */
const HANDLE_MARGIN = 2;

/** The handle hole in the front panel's frame (x right, y down from the open top edge). */
export function handleHole(box: DrawerBox): Polygon | undefined {
  const handle = box.opening.def.handle;
  if (!handle) return undefined;
  const cx = box.width / 2;
  const cy = handle.offset ?? box.height / 2;
  const rx = handle.width / 2;
  const ry = handle.height / 2;
  if (handle.shape === 'rectangle') return rect(cx - rx, cy - ry, cx + rx, cy + ry);
  return Array.from({ length: ELLIPSE_SEGMENTS }, (_, i) => {
    const phi = (2 * Math.PI * i) / ELLIPSE_SEGMENTS;
    return { x: cx + rx * Math.cos(phi), y: cy + ry * Math.sin(phi) };
  });
}

export function validateDrawer(config: CabinetConfig, box: DrawerBox): string[] {
  const dt = config.material.drawerThickness;
  const errors: string[] = [];
  if (box.width < 4 * dt || box.height < 3 * dt || box.depth < 4 * dt) {
    errors.push(`${box.name} is too small (${box.width.toFixed(1)} × ${box.height.toFixed(1)} mm)`);
    return errors;
  }
  const hole = handleHole(box);
  if (hole) {
    const b = bounds([hole]);
    const m = HANDLE_MARGIN;
    if (b.minX < dt + m || b.maxX > box.width - dt - m || b.minY < m || b.maxY > box.height - dt - m) {
      const { width, height } = box.opening.def.handle!;
      errors.push(`${box.name}: handle (${width} × ${height} mm) does not fit the front`);
    }
  }
  return errors;
}

export function drawerParts(config: CabinetConfig, box: DrawerBox): Part[] {
  const dt = config.material.drawerThickness;
  const fw = config.material.fingerWidth;
  const { width: w, height: h, depth: d, name, code } = box;
  const finger = (high: boolean): EdgeSpec => ({ kind: 'finger', high, depth: dt, fingerWidth: fw });

  const compartments = compartmentParts(config, box);
  const hole = handleHole(box);

  // Front/back frame: x = x, y = y. Edges: top(open), right side, bottom, left side.
  const frontBack = (label: string, letter: string, holes: Polygon[] = []) =>
    buildPanel(`${name} ${label}`, `${code}-${letter}`, {
      width: w,
      height: h,
      edges: [{ kind: 'plain' }, finger(false), finger(true), finger(false)],
      holes,
    });

  const front = frontBack('Front', 'F', hole ? [hole] : []);
  if (hole) {
    // Keep the engraved code off the hole: use the taller band above or below it.
    const b = bounds([hole]);
    const [minY, maxY] = h - dt - b.maxY >= b.minY ? [b.maxY, h - dt] : [0, b.minY];
    front.labelBox = { minX: dt, maxX: w - dt, minY, maxY };
  }

  // Side frame: x = z, y = y. Edges: top(open), back, bottom, front.
  const side = (label: string, letter: string) =>
    buildPanel(`${name} ${label}`, `${code}-${letter}`, {
      width: d,
      height: h,
      edges: [{ kind: 'plain' }, finger(true), finger(true), finger(true)],
      ownedCorners: [false, false, true, true],
    });

  return [
    front,
    frontBack('Back', 'B'),
    side('Left', 'L'),
    side('Right', 'R'),
    // Bottom frame: x = x, y = z. Edges: front, right, back, left.
    buildPanel(`${name} Bottom`, `${code}-U`, {
      width: w,
      height: d,
      edges: [finger(false), finger(false), finger(false), finger(false)],
      holes: compartments.bottomSlots,
    }),
    ...compartments.parts,
  ];
}

export function allDrawerBoxes(layout: CabinetLayout): DrawerBox[] {
  return layout.drawers.filter((o) => o.def.drawer).map((o) => drawerBox(layout, o));
}
