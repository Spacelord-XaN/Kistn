export const EXAMPLE_XML = `<Cabinet Width="400" Height="300" Depth="250">
  <Material Thickness="3" DrawerThickness="3" Kerf="0.15" Clearance="0.5" FingerWidth="10" />
  <Export SheetWidth="600" Spacing="5" />

  <Grid RowDefinitions="1*, 2*, 1*" ColumnDefinitions="1*, 1*, 1*">
    <!-- Wide drawer across the first two columns, split into compartments -->
    <Drawer Grid.Row="0" Grid.Column="0" Grid.ColumnSpan="2" NotchWidth="30" NotchDepth="15">
      <Compartments RowDefinitions="1*, 1*" ColumnDefinitions="2*, 1*" />
    </Drawer>

    <!-- Tall drawer spanning the bottom two rows -->
    <Drawer Grid.Row="1" Grid.Column="0" Grid.RowSpan="2" />

    <!-- Cells without a <Drawer> get a plain 1x1 drawer automatically -->
  </Grid>
</Cabinet>
`;
