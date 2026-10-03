import { fingerSegments } from './fingers';
import { Bounds, cleanPolygon, Polygon } from './path';

/**
 * A feature on a plain edge, as [axisCoordinate, depth] points in ascending
 * axis order. The axis is x for the top/bottom edges and y for the left/right
 * edges; depth is measured inward from the edge (negative = protruding tab).
 */
export type Feature = [number, number][];

export type EdgeSpec =
  | { kind: 'plain'; features?: Feature[] }
  | {
      kind: 'finger';
      /** The high side owns the fingers at the ends of the jointed run. */
      high: boolean;
      /** Thickness of the mating panel = how deep the gaps are cut. */
      depth: number;
      fingerWidth: number;
    };

/**
 * A rectangular panel `width` × `height` in its own frame (y pointing down).
 * Edges are ordered top (y=0), right (x=width), bottom (y=height), left (x=0).
 * Corner k sits at the start of edge k: top-left, top-right, bottom-right,
 * bottom-left. Where two finger edges meet, `ownedCorners[k]` says whether
 * this panel fills the corner cube or leaves it to a neighbour.
 */
export interface PanelSpec {
  width: number;
  height: number;
  edges: [EdgeSpec, EdgeSpec, EdgeSpec, EdgeSpec];
  ownedCorners?: [boolean, boolean, boolean, boolean];
  holes?: Polygon[];
}

export interface Part {
  /** Full descriptive name, used in messages and the SVG <title>. */
  name: string;
  /** Short code engraved on the part, e.g. "D0.1-F". */
  label: string;
  outline: Polygon;
  holes: Polygon[];
  /** Area to centre the engraved label in, in part coordinates; defaults to the outline's bounds. */
  labelBox?: Bounds;
}

export function rectFeature(a: number, b: number, depth: number): Feature {
  return [
    [a, depth],
    [b, depth],
  ];
}

export function buildPanel(name: string, label: string, spec: PanelSpec): Part {
  const { width: w, height: h, edges } = spec;
  const owned = spec.ownedCorners ?? [false, false, false, false];
  const len = [w, h, w, h];
  const prev = (k: number) => (k + 3) % 4;
  const next = (k: number) => (k + 1) % 4;
  const isFinger = (k: number) => edges[k].kind === 'finger';
  const depthOf = (k: number) => {
    const e = edges[k];
    return e.kind === 'finger' ? e.depth : 0;
  };
  const cornerJointed = (k: number) => isFinger(prev(k)) && isFinger(k);

  // Features of every edge in edge-local coordinates: s runs along the
  // traversal direction from corner k to corner k+1.
  const local: Feature[][] = edges.map((edge, k) => {
    if (edge.kind === 'finger') {
      const feats: Feature[] = [];
      const s0 = cornerJointed(k) ? depthOf(prev(k)) : 0;
      const s1 = len[k] - (cornerJointed(next(k)) ? depthOf(next(k)) : 0);
      if (cornerJointed(k)) feats.push(rectFeature(0, s0, owned[k] ? 0 : edge.depth));
      for (const seg of fingerSegments(s0, s1, edge.fingerWidth, edge.high, edge.depth)) {
        feats.push(rectFeature(seg.a, seg.b, seg.depth));
      }
      if (cornerJointed(next(k))) feats.push(rectFeature(s1, len[k], owned[next(k)] ? 0 : edge.depth));
      return feats;
    }
    const reversed = k >= 2;
    return (edge.features ?? [])
      .map((f) => (reversed ? f.map(([a, d]) => [len[k] - a, d] as [number, number]).reverse() : f))
      .sort((f1, f2) => f1[0][0] - f2[0][0])
      .map((f): Feature => [[f[0][0], 0], ...f, [f[f.length - 1][0], 0]]); // step out from / back to the edge line
  });

  const toPanel = (k: number, s: number, d: number) => {
    switch (k) {
      case 0:
        return { x: s, y: d };
      case 1:
        return { x: w - d, y: s };
      case 2:
        return { x: w - s, y: h - d };
      default:
        return { x: d, y: h - s };
    }
  };

  // Corner insets: a = inset along the incoming edge's normal (taken from the
  // incoming edge's last feature), b = along the outgoing edge's normal.
  const touchEnd = (k: number) => {
    const f = local[k][local[k].length - 1];
    if (!f) return 0;
    const last = f[f.length - 1];
    return last[0] >= len[k] - 1e-9 ? Math.max(0, last[1]) : 0;
  };
  const touchStart = (k: number) => {
    const f = local[k][0];
    if (!f) return 0;
    return f[0][0] <= 1e-9 ? Math.max(0, f[0][1]) : 0;
  };
  const cornerA = [0, 1, 2, 3].map((k) => touchEnd(prev(k)));
  const cornerB = [0, 1, 2, 3].map((k) => touchStart(k));

  const outline: Polygon = [];
  for (let k = 0; k < 4; k++) {
    outline.push(toPanel(k, cornerA[k], cornerB[k]));
    const lo = cornerA[k];
    const hi = len[k] - cornerB[next(k)];
    for (const f of local[k]) {
      if (f[f.length - 1][0] < lo || f[0][0] > hi) continue;
      for (const [s, d] of f) outline.push(toPanel(k, Math.min(hi, Math.max(lo, s)), d));
    }
  }

  return { name, label, outline: cleanPolygon(outline), holes: spec.holes ?? [] };
}
