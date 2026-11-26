// Kestrel Post — deterministic randomness and small math helpers.
// One job: a seeded RNG so the island, its trees and clouds are the same on
// every visit and in every screenshot, plus the clamps and lerps used by all.

// mulberry32: a tiny seeded PRNG, good enough for scattering trees.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Smooth 0..1 ramp between two edges, for terrain flattening and fades.
export function smoothstep(edge0, edge1, v) {
  const t = clamp((v - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Wrap an angle to [-PI, PI) so heading maths never spins the long way round.
export function wrapAngle(a) {
  while (a >= Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Compass point names for the HUD heading readout.
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export function compassPoint(headingRad) {
  const deg = ((headingRad * 180) / Math.PI + 360) % 360;
  return POINTS[Math.round(deg / 45) % 8];
}

export function headingDeg(headingRad) {
  return Math.round(((headingRad * 180) / Math.PI + 360) % 360);
}
