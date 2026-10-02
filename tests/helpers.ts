import { JSDOM } from 'jsdom';
import { Part } from '../src/geometry/panel';
import { signedArea } from '../src/geometry/path';

export const domParser = (): DOMParser => new new JSDOM().window.DOMParser();

/** Material area of a part: outline minus holes. */
export function partArea(p: Part): number {
  return Math.abs(signedArea(p.outline)) - p.holes.reduce((s, h) => s + Math.abs(signedArea(h)), 0);
}

export const sumArea = (parts: Part[]) => parts.reduce((s, p) => s + partArea(p), 0);
