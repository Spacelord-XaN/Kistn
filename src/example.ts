export const EXAMPLE_XML = `<Cabinet Width="400" Height="300" Depth="250">
  <Material Thickness="3" DrawerThickness="3" Kerf="0.15" Clearance="0.5" FingerWidth="10" />
  <Export Spacing="5" />
  <!-- Handle hole in every drawer front; Shape is Circle, Rectangle or None -->
  <Handle Shape="Circle" Width="30" Height="20" Offset="15" />
  <!-- Air hole in the cabinet back behind every drawer, so drawers slide without suction -->
  <Vent Shape="Circle" Width="20" />

  <Grid Rows="1*, 2*, 1*" Columns="1*, 1*, 1*">
    <!-- Wide drawer across the first two columns, split into compartments -->
    <Drawer Row="0" Column="0" ColumnSpan="2">
      <Handle Shape="Rectangle" Width="60" />
      <Compartments Rows="1*, 1*" Columns="2*, 1*" />
    </Drawer>

    <!-- Tall drawer spanning the bottom two rows -->
    <Drawer Row="1" Column="0" RowSpan="2" />

    <!-- Open slot: shelves and dividers stay, no drawer is generated.
         Drawers="False" on <Grid> makes this the default for all cells. -->
    <Drawer Row="2" Column="2" Drawer="False" />

    <!-- Cells without a <Drawer> get a plain 1x1 drawer automatically -->
  </Grid>
</Cabinet>
`;
