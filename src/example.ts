export const EXAMPLE_XML = `<Cabinet Width="400" Height="300" Depth="250">
  <Material Thickness="3" DrawerThickness="3" Kerf="0.15" Clearance="0.5" FingerWidth="10" />
  <Export Spacing="5" />

  <Grid Rows="1*, 2*, 1*" Columns="1*, 1*, 1*">
    <!-- Wide drawer across the first two columns, split into compartments -->
    <Drawer Row="0" Column="0" ColumnSpan="2">
      <Compartments Rows="1*, 1*" Columns="2*, 1*" />
    </Drawer>

    <!-- Tall drawer spanning the bottom two rows -->
    <Drawer Row="1" Column="0" RowSpan="2" />

    <!-- Cells without a <Drawer> get a plain 1x1 drawer automatically -->
  </Grid>
</Cabinet>
`;
