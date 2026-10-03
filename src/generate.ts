import { parseConfig } from './config/parse';
import { CabinetConfig } from './config/types';
import { applyKerf } from './export/kerf';
import { Part } from './geometry/panel';
import { CabinetLayout, computeLayout, validateLayout } from './layout/grid';
import { cabinetParts } from './parts/cabinet';
import { validateCompartments } from './parts/compartments';
import { dividerParts } from './parts/dividers';
import { allDrawerBoxes, DrawerBox, drawerParts, validateDrawer } from './parts/drawer';

export interface GenerateResult {
  errors: string[];
  config?: CabinetConfig;
  layout?: CabinetLayout;
  boxes?: DrawerBox[];
  /** Nominal parts (no kerf). */
  parts?: Part[];
  /** Parts with kerf compensation applied, ready to cut. */
  cutParts?: Part[];
  /** cutParts grouped by assembly: cabinet, shelves/dividers, then one group per drawer. */
  cutGroups?: Part[][];
}

export function generateFromConfig(config: CabinetConfig): GenerateResult {
  const layout = computeLayout(config);
  const layoutErrors = validateLayout(layout);
  if (layoutErrors.length) return { errors: layoutErrors, config, layout };

  const boxes = allDrawerBoxes(layout);
  const drawerErrors = boxes.flatMap((b) => [...validateDrawer(config, b), ...validateCompartments(config, b)]);
  if (drawerErrors.length) return { errors: drawerErrors, config, layout, boxes };

  const groups = [cabinetParts(layout), dividerParts(layout), ...boxes.map((b) => drawerParts(config, b))];
  const parts = groups.flat();
  const cutGroups = groups.map((g) => g.map((p) => applyKerf(p, config.material.kerf)));
  return { errors: [], config, layout, boxes, parts, cutParts: cutGroups.flat(), cutGroups };
}

export function generate(xml: string, parser?: DOMParser): GenerateResult {
  const parsed = parseConfig(xml, parser);
  if (!parsed.config) return { errors: parsed.errors };
  return generateFromConfig(parsed.config);
}
