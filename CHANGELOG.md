<!--
Release notes, shown in the app when clicking the version next to the title.
Format: https://keepachangelog.com — versions follow https://semver.org.

To release:
  1. Move the Unreleased entries under "## [x.y.z] - YYYY-MM-DD" and commit.
  2. git tag -a vx.y.z -m "BoxGen x.y.z"
  3. ./publish.sh <target-dir> — the build takes its version from the tag.
-->

# Changelog

## [Unreleased]

## [0.2.2] - 2026-10-09

### Added

- "Volume" checkbox below the preview: shows each drawer's usable inside volume in liters. The summary line shows the total.

## [0.2.1] - 2026-10-09

### Added

- Optional drawers: `Drawer="False"` on a `<Drawer>` leaves that slot open (shelves and dividers stay, no drawer parts are generated). `Drawers="False"` on `<Grid>` makes that the default for all cells, and `Drawer="True"` turns individual drawers back on.
- "Inside dimensions" checkbox below the preview: labels drawers with their usable inside size instead of the outside size.

## [0.2.0] - 2026-10-03

### Added

- Optional handle hole in drawer fronts: `<Handle Shape="Circle|Rectangle|None" Width Height Offset />` under `<Cabinet>` sets it for all drawers, a `<Handle>` inside a `<Drawer>` overrides it.
- Front view with drawer, shelf and divider codes plus a legend in the label layer of the exported SVG.

### Changed

- Shorter grid names in the XML: `Rows`/`Columns` instead of `RowDefinitions`/`ColumnDefinitions` (also `<Grid.Rows>`/`<Grid.Columns>` with `<Row>`/`<Column>` instead of `<RowDefinition>`/`<ColumnDefinition>`), and `Row`/`Column`/`RowSpan`/`ColumnSpan` on `<Drawer>` instead of `Grid.Row`/`Grid.Column`/`Grid.RowSpan`/`Grid.ColumnSpan`. The old names are no longer accepted.
- Labels in the exported SVG use short codes (e.g. `C-B`, `S1`, `V2`, `D0.1-F`, `D0.1-CD1`) so they fit the parts.
- Exported parts are laid out in one row per assembly instead of being wrapped to a sheet width.

### Removed

- `SheetWidth` on `<Export>`; arranging parts on the material is left to the laser software.

## [0.1.0] - 2026-10-02

### Added

- Laser-cut drawer cabinet generator: XML editor with live front preview and SVG export with kerf compensation.
- Label layer in the exported SVG.
- `run.sh` to start the dev server without sourcing nvm.
- `publish.sh` to build and deploy into a web server directory.
- Version display and release notes in the app.

### Changed

- The star is optional in row/column definitions (`1, 2` means `1*, 2*`).

### Removed

- U-notch handle on drawer fronts.
