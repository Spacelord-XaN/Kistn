import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config/parse';
import { EXAMPLE_XML } from '../src/example';
import { domParser } from './helpers';

const parse = (xml: string) => parseConfig(xml, domParser());

describe('parseConfig', () => {
  it('parses the example and fills uncovered cells with implicit drawers', () => {
    const { config, errors } = parse(EXAMPLE_XML);
    expect(errors).toEqual([]);
    expect(config!.rows).toEqual([1, 2, 1]);
    expect(config!.cols).toEqual([1, 1, 1]);
    expect(config!.material.kerf).toBe(0.15);
    // 3 explicit + 4 implicit (9 cells, 2 + 2 covered by spans)
    expect(config!.drawers).toHaveLength(7);
    expect(config!.drawers.filter((d) => d.implicit)).toHaveLength(4);
    expect(config!.drawers.filter((d) => !d.drawer)).toHaveLength(1);
    const wide = config!.drawers.find((d) => d.colSpan === 2)!;
    expect(wide.compartments).toEqual({ rows: [1, 1], cols: [2, 1] });
  });

  it('applies the cabinet handle to all drawers and merges per-drawer overrides', () => {
    const { config, errors } = parse(`
      <Cabinet Width="300" Height="200" Depth="150">
        <Handle Shape="circle" Width="40" Height="20" Offset="15" />
        <Grid Rows="*,*,*" Columns="*">
          <Drawer Row="0"><Handle Shape="Rectangle" Width="60" /></Drawer>
          <Drawer Row="1"><Handle Shape="None" /></Drawer>
        </Grid>
      </Cabinet>`);
    expect(errors).toEqual([]);
    const [d0, d1, d2] = config!.drawers;
    expect(d0.handle).toEqual({ shape: 'rectangle', width: 60, height: 20, offset: 15 });
    expect(d1.handle).toBeUndefined();
    expect(d2.implicit).toBe(true);
    expect(d2.handle).toEqual({ shape: 'circle', width: 40, height: 20, offset: 15 });
  });

  it('has no handle by default; a lone per-drawer handle is a centred circle', () => {
    const { config, errors } = parse(`
      <Cabinet Width="300" Height="200" Depth="150">
        <Grid Rows="*,*" Columns="*"><Drawer Row="0"><Handle Width="25" /></Drawer></Grid>
      </Cabinet>`);
    expect(errors).toEqual([]);
    expect(config!.drawers[0].handle).toEqual({ shape: 'circle', width: 25, height: 25, offset: undefined });
    expect(config!.drawers[1].handle).toBeUndefined();
  });

  it('reports bad handle shapes and attributes', () => {
    const { errors } = parse(`
      <Cabinet Width="300" Height="200" Depth="150">
        <Handle Shape="Oval" />
        <Grid><Drawer><Handle Size="3" Width="0" /></Drawer></Grid>
      </Cabinet>`);
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).toMatch(/"Shape" must be one of Circle, Rectangle, None, got "Oval"/);
    expect(errors.join('\n')).toMatch(/unknown attribute "Size"/);
    expect(errors.join('\n')).toMatch(/"Width" must be at least 1/);
  });

  it('has drawers by default; Drawers on <Grid> sets the default and Drawer overrides it', () => {
    expect(parse(`<Cabinet Width="300" Height="200" Depth="150" />`).config!.drawers[0].drawer).toBe(true);
    const { config, errors } = parse(`
      <Cabinet Width="300" Height="200" Depth="150">
        <Handle Width="20" />
        <Grid Rows="*,*,*" Columns="*" Drawers="false">
          <Drawer Row="0" Drawer="TRUE" />
          <Drawer Row="1" />
        </Grid>
      </Cabinet>`);
    expect(errors).toEqual([]);
    const [d0, d1, d2] = config!.drawers;
    expect([d0.drawer, d1.drawer, d2.drawer]).toEqual([true, false, false]);
    expect(d2.implicit).toBe(true);
    // Open slots don't inherit the cabinet handle.
    expect(d0.handle).toBeDefined();
    expect(d1.handle).toBeUndefined();
    expect(d2.handle).toBeUndefined();
  });

  it('reports bad Drawer values and children of open slots', () => {
    const { errors } = parse(`
      <Cabinet Width="300" Height="200" Depth="150">
        <Grid Rows="*,*" Columns="*" Drawers="maybe">
          <Drawer Row="0" Drawer="no" />
          <Drawer Row="1" Drawer="False"><Handle /><Compartments Rows="*,*" /></Drawer>
        </Grid>
      </Cabinet>`);
    expect(errors).toHaveLength(4);
    expect(errors.join('\n')).toMatch(/<Grid>: "Drawers" must be True or False, got "maybe"/);
    expect(errors.join('\n')).toMatch(/"Drawer" must be True or False, got "no"/);
    expect(errors.join('\n')).toMatch(/<Handle> is not allowed with Drawer="False"/);
    expect(errors.join('\n')).toMatch(/<Compartments> is not allowed with Drawer="False"/);
  });

  it('supports XAML property-element definitions', () => {
    const { config, errors } = parse(`
      <Cabinet Width="300" Height="200" Depth="150">
        <Grid>
          <Grid.Rows><Row Height="2*"/><Row Height="*"/></Grid.Rows>
          <Grid.Columns><Column Width="1*"/></Grid.Columns>
        </Grid>
      </Cabinet>`);
    expect(errors).toEqual([]);
    expect(config!.rows).toEqual([2, 1]);
    expect(config!.cols).toEqual([1]);
    expect(config!.drawers).toHaveLength(2);
  });

  it('reports overlapping spans', () => {
    const { errors } = parse(`
      <Cabinet Width="300" Height="200" Depth="150">
        <Grid Rows="*,*" Columns="*,*">
          <Drawer Row="0" Column="0" ColumnSpan="2" />
          <Drawer Row="0" Column="1" RowSpan="2" />
        </Grid>
      </Cabinet>`);
    expect(errors.join()).toMatch(/overlaps <Drawer> #1 at Row 0, Column 1/);
  });

  it('reports spans outside the grid, unknown attributes and bad stars', () => {
    expect(
      parse(`<Cabinet Width="300" Height="200" Depth="150"><Grid Rows="*"><Drawer RowSpan="2"/></Grid></Cabinet>`)
        .errors.join(),
    ).toMatch(/exceed the grid/);
    expect(parse(`<Cabinet Width="300" Height="200" Depth="150" Colour="red"/>`).errors.join()).toMatch(
      /unknown attribute "Colour"/,
    );
    expect(
      parse(`<Cabinet Width="300" Height="200" Depth="150"><Grid Rows="Auto,*"/></Cabinet>`).errors.join(),
    ).toMatch(/not a star size/);
  });

  it('reports XML syntax errors and missing dimensions', () => {
    expect(parse('<Cabinet Width="1"').errors[0]).toMatch(/XML syntax error/);
    expect(parse('<Cabinet Width="300" Height="200" />').errors.join()).toMatch(/missing required attribute "Depth"/);
  });
});
