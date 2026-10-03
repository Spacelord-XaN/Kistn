import { CabinetConfig } from '../config/types';
import { EdgeSpec, buildPanel, Part } from '../geometry/panel';
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

export function validateDrawer(config: CabinetConfig, box: DrawerBox): string[] {
  const dt = config.material.drawerThickness;
  const errors: string[] = [];
  if (box.width < 4 * dt || box.height < 3 * dt || box.depth < 4 * dt) {
    errors.push(`${box.name} is too small (${box.width.toFixed(1)} × ${box.height.toFixed(1)} mm)`);
  }
  return errors;
}

export function drawerParts(config: CabinetConfig, box: DrawerBox): Part[] {
  const dt = config.material.drawerThickness;
  const fw = config.material.fingerWidth;
  const { width: w, height: h, depth: d, name, code } = box;
  const finger = (high: boolean): EdgeSpec => ({ kind: 'finger', high, depth: dt, fingerWidth: fw });

  const compartments = compartmentParts(config, box);

  // Front/back frame: x = x, y = y. Edges: top(open), right side, bottom, left side.
  const frontBack = (label: string, letter: string) =>
    buildPanel(`${name} ${label}`, `${code}-${letter}`, {
      width: w,
      height: h,
      edges: [{ kind: 'plain' }, finger(false), finger(true), finger(false)],
    });

  // Side frame: x = z, y = y. Edges: top(open), back, bottom, front.
  const side = (label: string, letter: string) =>
    buildPanel(`${name} ${label}`, `${code}-${letter}`, {
      width: d,
      height: h,
      edges: [{ kind: 'plain' }, finger(true), finger(true), finger(true)],
      ownedCorners: [false, false, true, true],
    });

  return [
    frontBack('Front', 'F'),
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
  return layout.drawers.map((o) => drawerBox(layout, o));
}
