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
    // 2 explicit + 5 implicit (9 cells, 2 + 2 covered by spans)
    expect(config!.drawers).toHaveLength(7);
    expect(config!.drawers.filter((d) => d.implicit)).toHaveLength(5);
    const wide = config!.drawers.find((d) => d.colSpan === 2)!;
    expect(wide.compartments).toEqual({ rows: [1, 1], cols: [2, 1] });
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
