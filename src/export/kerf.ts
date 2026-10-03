import { Part } from '../geometry/panel';
import { offsetPolygon } from '../geometry/path';

/** Grows outlines and shrinks holes by kerf/2 so cut parts come out nominal. */
export function applyKerf(part: Part, kerf: number): Part {
  if (kerf <= 0) return part;
  const d = kerf / 2;
  return {
    name: part.name,
    label: part.label,
    outline: offsetPolygon(part.outline, d),
    holes: part.holes.map((h) => offsetPolygon(h, -d)),
  };
}
