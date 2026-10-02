import {
  CabinetConfig,
  CompartmentDef,
  DEFAULT_EXPORT,
  DEFAULT_MATERIAL,
  DrawerDef,
} from './types';
import { parseStars } from '../layout/stars';

export interface ParseResult {
  config?: CabinetConfig;
  errors: string[];
}

class Errors {
  list: string[] = [];
  add(msg: string) {
    this.list.push(msg);
  }
}

function checkAttributes(el: Element, allowed: string[], errors: Errors) {
  for (const attr of Array.from(el.attributes)) {
    if (!allowed.includes(attr.name)) {
      errors.add(`<${el.tagName}>: unknown attribute "${attr.name}" (allowed: ${allowed.join(', ')})`);
    }
  }
}

function numberAttr(
  el: Element,
  name: string,
  errors: Errors,
  opts: { def?: number; min?: number; integer?: boolean; label?: string },
): number {
  const label = opts.label ?? `<${el.tagName}>`;
  const raw = el.getAttribute(name);
  if (raw === null) {
    if (opts.def === undefined) {
      errors.add(`${label}: missing required attribute "${name}"`);
      return NaN;
    }
    return opts.def;
  }
  const value = Number(raw.trim());
  if (raw.trim() === '' || !Number.isFinite(value)) {
    errors.add(`${label}: "${name}" must be a number, got "${raw}"`);
    return NaN;
  }
  if (opts.integer && !Number.isInteger(value)) {
    errors.add(`${label}: "${name}" must be a whole number, got "${raw}"`);
  }
  if (opts.min !== undefined && value < opts.min) {
    errors.add(`${label}: "${name}" must be at least ${opts.min}, got ${value}`);
  }
  return value;
}

function childElements(el: Element, tag?: string): Element[] {
  return Array.from(el.children).filter((c) => tag === undefined || c.tagName === tag);
}

/**
 * Reads row or column definitions either from an attribute
 * (RowDefinitions="1*,2*") or from XAML property-element syntax:
 * <Grid.RowDefinitions><RowDefinition Height="2*"/></Grid.RowDefinitions>.
 */
function readDefinitions(
  el: Element,
  kind: 'Row' | 'Column',
  errors: Errors,
  label: string,
): number[] | undefined {
  const attrName = `${kind}Definitions`;
  const sizeAttr = kind === 'Row' ? 'Height' : 'Width';
  const propTag = `${el.tagName}.${attrName}`;
  const attr = el.getAttribute(attrName);
  const prop = childElements(el, propTag)[0];
  if (attr !== null && prop) {
    errors.add(`${label}: ${attrName} is given both as attribute and as <${propTag}>`);
  }
  if (attr !== null) {
    try {
      return parseStars(attr);
    } catch (e) {
      errors.add(`${label} ${attrName}: ${(e as Error).message}`);
      return undefined;
    }
  }
  if (prop) {
    const defs = childElements(prop);
    const weights: number[] = [];
    for (const d of defs) {
      if (d.tagName !== `${kind}Definition`) {
        errors.add(`<${propTag}>: unexpected element <${d.tagName}>`);
        continue;
      }
      checkAttributes(d, [sizeAttr], errors);
      try {
        weights.push(...parseStars(d.getAttribute(sizeAttr) ?? '*'));
      } catch (e) {
        errors.add(`<${d.tagName}>: ${(e as Error).message}`);
      }
    }
    if (defs.length === 0) errors.add(`<${propTag}> is empty`);
    return weights;
  }
  return [1];
}

function parseCompartments(el: Element, errors: Errors, label: string): CompartmentDef | undefined {
  const lbl = `${label} <Compartments>`;
  checkAttributes(el, ['RowDefinitions', 'ColumnDefinitions'], errors);
  for (const c of childElements(el)) {
    if (c.tagName !== 'Compartments.RowDefinitions' && c.tagName !== 'Compartments.ColumnDefinitions') {
      errors.add(`${lbl}: unexpected element <${c.tagName}>`);
    }
  }
  const rows = readDefinitions(el, 'Row', errors, lbl);
  const cols = readDefinitions(el, 'Column', errors, lbl);
  if (!rows || !cols) return undefined;
  if (rows.length === 1 && cols.length === 1) return undefined;
  return { rows, cols };
}

function describeDrawer(el: Element, index: number): string {
  const r = el.getAttribute('Grid.Row') ?? '0';
  const c = el.getAttribute('Grid.Column') ?? '0';
  return `<Drawer> #${index + 1} (Row ${r}, Column ${c})`;
}

export function parseConfig(xml: string, parser: DOMParser = new DOMParser()): ParseResult {
  const errors = new Errors();
  const doc = parser.parseFromString(xml, 'application/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    const text = (parseError.textContent ?? 'Invalid XML').trim().split('\n').slice(0, 3).join(' ');
    return { errors: [`XML syntax error: ${text}`] };
  }

  const root = doc.documentElement;
  if (root.tagName !== 'Cabinet') {
    return { errors: [`Root element must be <Cabinet>, found <${root.tagName}>`] };
  }
  checkAttributes(root, ['Width', 'Height', 'Depth'], errors);
  const width = numberAttr(root, 'Width', errors, { min: 1 });
  const height = numberAttr(root, 'Height', errors, { min: 1 });
  const depth = numberAttr(root, 'Depth', errors, { min: 1 });

  for (const c of childElements(root)) {
    if (!['Material', 'Grid', 'Export'].includes(c.tagName)) {
      errors.add(`<Cabinet>: unexpected element <${c.tagName}> (allowed: Material, Grid, Export)`);
    }
  }

  const material = { ...DEFAULT_MATERIAL };
  const matEl = childElements(root, 'Material')[0];
  if (matEl) {
    checkAttributes(matEl, ['Thickness', 'DrawerThickness', 'Kerf', 'Clearance', 'FingerWidth'], errors);
    material.thickness = numberAttr(matEl, 'Thickness', errors, { def: material.thickness, min: 0.1 });
    material.drawerThickness = numberAttr(matEl, 'DrawerThickness', errors, {
      def: material.thickness,
      min: 0.1,
    });
    material.kerf = numberAttr(matEl, 'Kerf', errors, { def: material.kerf, min: 0 });
    material.clearance = numberAttr(matEl, 'Clearance', errors, { def: material.clearance, min: 0 });
    material.fingerWidth = numberAttr(matEl, 'FingerWidth', errors, { def: material.fingerWidth, min: 1 });
  }

  const exportSettings = { ...DEFAULT_EXPORT };
  const exportEl = childElements(root, 'Export')[0];
  if (exportEl) {
    checkAttributes(exportEl, ['SheetWidth', 'Spacing'], errors);
    exportSettings.sheetWidth = numberAttr(exportEl, 'SheetWidth', errors, { def: exportSettings.sheetWidth, min: 10 });
    exportSettings.spacing = numberAttr(exportEl, 'Spacing', errors, { def: exportSettings.spacing, min: 0 });
  }

  const gridEl = childElements(root, 'Grid')[0];
  let rows: number[] | undefined = [1];
  let cols: number[] | undefined = [1];
  const drawers: DrawerDef[] = [];
  if (gridEl) {
    checkAttributes(gridEl, ['RowDefinitions', 'ColumnDefinitions'], errors);
    rows = readDefinitions(gridEl, 'Row', errors, '<Grid>');
    cols = readDefinitions(gridEl, 'Column', errors, '<Grid>');
    childElements(gridEl).forEach((el) => {
      if (el.tagName === 'Grid.RowDefinitions' || el.tagName === 'Grid.ColumnDefinitions') return;
      if (el.tagName !== 'Drawer') {
        errors.add(`<Grid>: unexpected element <${el.tagName}> (only <Drawer> allowed)`);
        return;
      }
      const label = describeDrawer(el, drawers.length);
      checkAttributes(el, ['Grid.Row', 'Grid.Column', 'Grid.RowSpan', 'Grid.ColumnSpan'], errors);
      const drawer: DrawerDef = {
        row: numberAttr(el, 'Grid.Row', errors, { def: 0, min: 0, integer: true, label }),
        col: numberAttr(el, 'Grid.Column', errors, { def: 0, min: 0, integer: true, label }),
        rowSpan: numberAttr(el, 'Grid.RowSpan', errors, { def: 1, min: 1, integer: true, label }),
        colSpan: numberAttr(el, 'Grid.ColumnSpan', errors, { def: 1, min: 1, integer: true, label }),
        implicit: false,
      };
      for (const c of childElements(el)) {
        if (c.tagName !== 'Compartments') errors.add(`${label}: unexpected element <${c.tagName}>`);
      }
      const compEl = childElements(el, 'Compartments')[0];
      if (compEl) drawer.compartments = parseCompartments(compEl, errors, label);
      drawers.push(drawer);
    });
  }

  if (errors.list.length > 0 || !rows || !cols) return { errors: errors.list };

  // Place drawers on the grid, detecting out-of-range and overlapping spans.
  const owner: number[][] = rows.map(() => cols!.map(() => -1));
  drawers.forEach((d, i) => {
    const label = `<Drawer> #${i + 1} (Row ${d.row}, Column ${d.col})`;
    if (d.row + d.rowSpan > rows!.length) {
      errors.add(`${label}: rows ${d.row}..${d.row + d.rowSpan - 1} exceed the grid's ${rows!.length} row(s)`);
      return;
    }
    if (d.col + d.colSpan > cols!.length) {
      errors.add(
        `${label}: columns ${d.col}..${d.col + d.colSpan - 1} exceed the grid's ${cols!.length} column(s)`,
      );
      return;
    }
    for (let r = d.row; r < d.row + d.rowSpan; r++) {
      for (let c = d.col; c < d.col + d.colSpan; c++) {
        if (owner[r][c] >= 0) {
          errors.add(`${label}: overlaps <Drawer> #${owner[r][c] + 1} at Row ${r}, Column ${c}`);
          return;
        }
      }
    }
    for (let r = d.row; r < d.row + d.rowSpan; r++) {
      for (let c = d.col; c < d.col + d.colSpan; c++) owner[r][c] = i;
    }
  });
  if (errors.list.length > 0) return { errors: errors.list };

  // Cells without an explicit drawer get an implicit 1x1 drawer.
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      if (owner[r][c] < 0) {
        drawers.push({ row: r, col: c, rowSpan: 1, colSpan: 1, implicit: true });
      }
    }
  }
  drawers.sort((a, b) => a.row - b.row || a.col - b.col);

  return {
    config: { width, height, depth, material, rows, cols, drawers, export: exportSettings },
    errors: [],
  };
}
