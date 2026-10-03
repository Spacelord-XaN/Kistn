import { CabinetConfig } from '../config/types';
import { buildPanel, Feature, Part, rectFeature } from '../geometry/panel';
import { Polygon, rect } from '../geometry/path';
import { layoutAxis, Span } from '../layout/stars';
import type { DrawerBox } from './drawer';

/** How far compartment dividers stay below the drawer's top edge (mm). */
const TOP_GAP = 1;

export interface CompartmentGeometry {
  /** Along x (left→right) inside the drawer. */
  cols: Span[];
  /** Along z (front→back) inside the drawer. */
  rows: Span[];
  height: number;
}

export function compartmentGeometry(config: CabinetConfig, box: DrawerBox): CompartmentGeometry | undefined {
  const comp = box.opening.def.compartments;
  if (!comp) return undefined;
  const dt = config.material.drawerThickness;
  return {
    cols: layoutAxis(comp.cols, box.width, dt, dt),
    rows: layoutAxis(comp.rows, box.depth, dt, dt),
    height: box.height - dt - TOP_GAP,
  };
}

export function validateCompartments(config: CabinetConfig, box: DrawerBox): string[] {
  const g = compartmentGeometry(config, box);
  if (!g) return [];
  const dt = config.material.drawerThickness;
  const errors: string[] = [];
  if ([...g.cols, ...g.rows].some((s) => s.end - s.start < 2 * dt)) {
    errors.push(`${box.name}: compartments are too small for the material thickness`);
  }
  if (g.height < 4 * dt) errors.push(`${box.name}: drawer is too shallow for compartment dividers`);
  return errors;
}

/**
 * Egg-crate compartment dividers: dividers running front→back get half-lap
 * slots from the top, those running left→right from the bottom. Each divider
 * has one tab per compartment that locates it in a slot in the drawer bottom.
 */
export function compartmentParts(
  config: CabinetConfig,
  box: DrawerBox,
): { parts: Part[]; bottomSlots: Polygon[] } {
  const g = compartmentGeometry(config, box);
  if (!g) return { parts: [], bottomSlots: [] };
  const dt = config.material.drawerThickness;
  const fw = config.material.fingerWidth;
  const halfLap = g.height / 2;
  const tabsFor = (cells: Span[]): [number, number][] =>
    cells.map((c) => {
      const mid = (c.start + c.end) / 2;
      const half = Math.min(fw, (c.end - c.start) / 3) / 2;
      return [mid - half, mid + half];
    });
  const rowTabs = tabsFor(g.rows);
  const colTabs = tabsFor(g.cols);

  const parts: Part[] = [];
  const bottomSlots: Polygon[] = [];

  // Front→back dividers in the gaps between columns. Frame: x = z − dt, y = down.
  g.cols.slice(0, -1).forEach((c, i) => {
    const gx = c.end;
    const top: Feature[] = g.rows.slice(0, -1).map((r) => rectFeature(r.end - dt, r.end, halfLap));
    const bottom: Feature[] = rowTabs.map(([a, b]) => rectFeature(a - dt, b - dt, -dt));
    parts.push(
      buildPanel(`${box.name} Compartment Divider ${i + 1} (front-back)`, `${box.code}-CD${i + 1}`, {
        width: box.depth - 2 * dt,
        height: g.height,
        edges: [{ kind: 'plain', features: top }, { kind: 'plain' }, { kind: 'plain', features: bottom }, { kind: 'plain' }],
      }),
    );
    for (const [a, b] of rowTabs) bottomSlots.push(rect(gx, a, gx + dt, b));
  });

  // Left→right dividers in the gaps between rows. Frame: x = x − dt, y = down.
  g.rows.slice(0, -1).forEach((r, i) => {
    const gz = r.end;
    const bottom: Feature[] = [
      ...g.cols.slice(0, -1).map((c) => rectFeature(c.end - dt, c.end, halfLap)),
      ...colTabs.map(([a, b]) => rectFeature(a - dt, b - dt, -dt)),
    ];
    parts.push(
      buildPanel(`${box.name} Compartment Divider ${g.cols.length + i} (left-right)`, `${box.code}-CD${g.cols.length + i}`, {
        width: box.width - 2 * dt,
        height: g.height,
        edges: [{ kind: 'plain' }, { kind: 'plain' }, { kind: 'plain', features: bottom }, { kind: 'plain' }],
      }),
    );
    for (const [a, b] of colTabs) bottomSlots.push(rect(a, gz, b, gz + dt));
  });

  return { parts, bottomSlots };
}
