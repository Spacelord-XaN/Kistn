import { CabinetConfig, DrawerDef } from '../config/types';
import { layoutAxis, Span } from './stars';

/*
 * Cabinet coordinates: x = left→right, y = top→bottom, z = front→back.
 * The back panel occupies z ∈ [depth − t, depth]; everything in front of it
 * (dividers, drawers) lives in z ∈ [0, depth − t].
 */

export interface DrawerOpening {
  index: number;
  def: DrawerDef;
  /** Opening in the front face (between walls/dividers). */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export type EndKind = 'wall' | 'divider';

/** Horizontal divider ("shelf") lying in the gap below row `boundary`. */
export interface Shelf {
  boundary: number;
  /** Top face; the shelf occupies y ∈ [y, y + t]. */
  y: number;
  /** Faces of the walls/dividers the shelf ends against. */
  x0: number;
  x1: number;
  colStart: number;
  colEnd: number;
  leftEnd: EndKind;
  rightEnd: EndKind;
  /** Index of the vertical divider the shelf ends on, when an end is 'divider'. */
  leftVertical?: number;
  rightVertical?: number;
}

/** Vertical divider lying in the gap right of column `gap`. */
export interface Vertical {
  gap: number;
  /** Left face; the divider occupies x ∈ [x, x + t]. */
  x: number;
  y0: number;
  y1: number;
  rowStart: number;
  rowEnd: number;
  topEnd: EndKind;
  bottomEnd: EndKind;
  /** Index of the shelf this piece ends on, when an end is 'divider'. */
  topShelf?: number;
  bottomShelf?: number;
}

export interface CabinetLayout {
  config: CabinetConfig;
  t: number;
  /** Interior depth in front of the back panel. */
  innerDepth: number;
  cols: Span[];
  rows: Span[];
  /** owner[row][col] = index into `drawers`. */
  owner: number[][];
  drawers: DrawerOpening[];
  shelves: Shelf[];
  verticals: Vertical[];
}

export function computeLayout(config: CabinetConfig): CabinetLayout {
  const t = config.material.thickness;
  const cols = layoutAxis(config.cols, config.width, t, t);
  const rows = layoutAxis(config.rows, config.height, t, t);
  const nr = rows.length;
  const nc = cols.length;

  const owner: number[][] = rows.map(() => cols.map(() => -1));
  const drawers: DrawerOpening[] = config.drawers.map((def, index) => {
    for (let r = def.row; r < def.row + def.rowSpan; r++) {
      for (let c = def.col; c < def.col + def.colSpan; c++) owner[r][c] = index;
    }
    return {
      index,
      def,
      x0: cols[def.col].start,
      x1: cols[def.col + def.colSpan - 1].end,
      y0: rows[def.row].start,
      y1: rows[def.row + def.rowSpan - 1].end,
    };
  });

  // A shelf exists below row i in column c when the cells above/below differ;
  // a vertical exists right of column c in row r when the cells left/right differ.
  const hasShelf = (i: number, c: number) => owner[i][c] !== owner[i + 1][c];
  const hasVertical = (r: number, j: number) => owner[r][j] !== owner[r][j + 1];
  // Shelves run straight through a column gap whenever they exist on both sides.
  const shelfPasses = (i: number, j: number) => hasShelf(i, j) && hasShelf(i, j + 1);

  const shelves: Shelf[] = [];
  for (let i = 0; i < nr - 1; i++) {
    let c = 0;
    while (c < nc) {
      if (!hasShelf(i, c)) {
        c++;
        continue;
      }
      const start = c;
      while (c + 1 < nc && hasShelf(i, c + 1)) c++;
      shelves.push({
        boundary: i,
        y: rows[i].end,
        x0: cols[start].start,
        x1: cols[c].end,
        colStart: start,
        colEnd: c,
        leftEnd: start === 0 ? 'wall' : 'divider',
        rightEnd: c === nc - 1 ? 'wall' : 'divider',
      });
      c++;
    }
  }

  const verticals: Vertical[] = [];
  for (let j = 0; j < nc - 1; j++) {
    let r = 0;
    while (r < nr) {
      if (!hasVertical(r, j)) {
        r++;
        continue;
      }
      const start = r;
      while (r + 1 < nr && hasVertical(r + 1, j) && !shelfPasses(r, j)) r++;
      verticals.push({
        gap: j,
        x: cols[j].end,
        y0: rows[start].start,
        y1: rows[r].end,
        rowStart: start,
        rowEnd: r,
        topEnd: start === 0 ? 'wall' : 'divider',
        bottomEnd: r === nr - 1 ? 'wall' : 'divider',
      });
      r++;
    }
  }

  // Link the pieces that end on each other.
  const shelfAt = (boundary: number, gap: number) =>
    shelves.findIndex((s) => s.boundary === boundary && s.colStart <= gap && s.colEnd >= gap + 1);
  verticals.forEach((v) => {
    if (v.topEnd === 'divider') v.topShelf = shelfAt(v.rowStart - 1, v.gap);
    if (v.bottomEnd === 'divider') v.bottomShelf = shelfAt(v.rowEnd, v.gap);
  });
  const verticalAt = (gap: number, boundary: number) =>
    verticals.findIndex((v) => v.gap === gap && v.rowStart <= boundary && v.rowEnd >= boundary + 1);
  shelves.forEach((s) => {
    if (s.leftEnd === 'divider') s.leftVertical = verticalAt(s.colStart - 1, s.boundary);
    if (s.rightEnd === 'divider') s.rightVertical = verticalAt(s.colEnd, s.boundary);
  });

  return { config, t, innerDepth: config.depth - t, cols, rows, owner, drawers, shelves, verticals };
}

/** Sanity checks on derived geometry that the parser can't catch. */
export function validateLayout(layout: CabinetLayout): string[] {
  const errors: string[] = [];
  const { config, t } = layout;
  const m = config.material;
  const minCell = 2 * m.clearance + 4 * m.drawerThickness;
  layout.cols.forEach((c, i) => {
    if (c.end - c.start < minCell) {
      errors.push(`Column ${i} is only ${(c.end - c.start).toFixed(1)} mm wide — too small for a drawer`);
    }
  });
  layout.rows.forEach((r, i) => {
    if (r.end - r.start < minCell) {
      errors.push(`Row ${i} is only ${(r.end - r.start).toFixed(1)} mm tall — too small for a drawer`);
    }
  });
  if (config.depth < 4 * t + 4 * m.drawerThickness) {
    errors.push(`Depth ${config.depth} mm is too small for the material thickness`);
  }
  if (2 * t >= config.width || 2 * t >= config.height) {
    errors.push('Cabinet is too small for the material thickness');
  }
  return errors;
}
