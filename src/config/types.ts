export interface Material {
  /** Cabinet panel thickness (mm). */
  thickness: number;
  /** Drawer panel thickness (mm). */
  drawerThickness: number;
  /** Laser kerf (mm); outlines are offset by kerf/2. */
  kerf: number;
  /** Gap per side between a drawer and its opening (mm). */
  clearance: number;
  /** Target finger / tab width (mm). */
  fingerWidth: number;
}

export interface CompartmentDef {
  /** Star weights front-to-back. */
  rows: number[];
  /** Star weights left-to-right. */
  cols: number[];
}

export type HandleShape = 'circle' | 'rectangle';

/** Handle hole cut into a drawer front. */
export interface HandleDef {
  shape: HandleShape;
  width: number;
  height: number;
  /** Distance from the front's top edge to the hole centre; undefined = vertically centred. */
  offset?: number;
}

export interface DrawerDef {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  compartments?: CompartmentDef;
  /** Handle hole in the front; undefined = none. */
  handle?: HandleDef;
  /** False = open slot: the opening stays, but no drawer box is generated. */
  drawer: boolean;
  /** True when generated for a cell not covered by any <Drawer>. */
  implicit: boolean;
}

export interface ExportSettings {
  /** Gap between parts in the exported SVG (mm). */
  spacing: number;
}

export interface CabinetConfig {
  width: number;
  height: number;
  depth: number;
  material: Material;
  rows: number[];
  cols: number[];
  drawers: DrawerDef[];
  export: ExportSettings;
}

export const DEFAULT_MATERIAL: Material = {
  thickness: 3,
  drawerThickness: 3,
  kerf: 0,
  clearance: 0.5,
  fingerWidth: 10,
};

export const DEFAULT_HANDLE_WIDTH = 30;

export const DEFAULT_EXPORT: ExportSettings = {
  spacing: 5,
};
