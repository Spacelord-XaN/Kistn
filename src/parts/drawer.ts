import { CabinetConfig, HandleDef } from '../config/types';
import { EdgeSpec, buildPanel, Part } from '../geometry/panel';
import { bandBeside, Bounds, bounds, Polygon, rect } from '../geometry/path';
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
/** Minimum material left around handle and vent holes (mm). */
const HOLE_MARGIN = 2;

/** A handle or vent hole of the given shape, centred at (cx, cy). */
function holePolygon(def: HandleDef, cx: number, cy: number): Polygon {
  const rx = def.width / 2;
  const ry = def.height / 2;
  if (def.shape === 'rectangle') return rect(cx - rx, cy - ry, cx + rx, cy + ry);
  return Array.from({ length: ELLIPSE_SEGMENTS }, (_, i) => {
    const phi = (2 * Math.PI * i) / ELLIPSE_SEGMENTS;
    return { x: cx + rx * Math.cos(phi), y: cy + ry * Math.sin(phi) };
  });
}

/** The handle hole in the front panel's frame (x right, y down from the open top edge). */
export function handleHole(box: DrawerBox): Polygon | undefined {
  const handle = box.opening.def.handle;
  if (!handle) return undefined;
  return holePolygon(handle, box.width / 2, handle.offset ?? box.height / 2);
}

/** The vent hole behind the drawer, in the cabinet back's frame (cabinet x and y). */
export function ventHole(box: DrawerBox): Polygon | undefined {
  const vent = box.opening.def.vent;
  if (!vent) return undefined;
  const { x0, x1, y0, y1 } = box.opening;
  return holePolygon(vent, (x0 + x1) / 2, y0 + (vent.offset ?? (y1 - y0) / 2));
}

/** Whether the hole stays at least HOLE_MARGIN inside the area. */
function holeFits(hole: Polygon, area: Bounds): boolean {
  const b = bounds([hole]);
  const m = HOLE_MARGIN;
  return b.minX >= area.minX + m && b.maxX <= area.maxX - m && b.minY >= area.minY + m && b.maxY <= area.maxY - m;
}

export function validateDrawer(config: CabinetConfig, box: DrawerBox): string[] {
  const dt = config.material.drawerThickness;
  const errors: string[] = [];
  if (box.width < 4 * dt || box.height < 3 * dt || box.depth < 4 * dt) {
    errors.push(`${box.name} is too small (${box.width.toFixed(1)} × ${box.height.toFixed(1)} mm)`);
    return errors;
  }
  const hole = handleHole(box);
  if (hole && !holeFits(hole, { minX: dt, maxX: box.width - dt, minY: 0, maxY: box.height - dt })) {
    const { width, height } = box.opening.def.handle!;
    errors.push(`${box.name}: handle (${width} × ${height} mm) does not fit the front`);
  }
  // The margin keeps the vent clear of the shelf/divider slots around the opening.
  const vent = ventHole(box);
  const { x0, x1, y0, y1 } = box.opening;
  if (vent && !holeFits(vent, { minX: x0, maxX: x1, minY: y0, maxY: y1 })) {
    const { width, height } = box.opening.def.vent!;
    errors.push(`${box.name}: vent (${width} × ${height} mm) does not fit the opening`);
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
    front.labelBox = bandBeside({ minX: dt, maxX: w - dt, minY: 0, maxY: h - dt }, hole);
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
