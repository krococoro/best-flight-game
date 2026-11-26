// Kestrel Post — the island: heightfield, airfields, trees and clouds.
// One job: describe the world the plane flies over, as pure functions of
// position, so physics and rendering always agree about the ground.

import { WORLD, RINGS } from './config.js';
import { makeRng, clamp, smoothstep } from './random.js';

// Distance from a point to a runway strip's rectangle (0 when over it).
function runwayDistance(rwy, x, y) {
  const dx = Math.max(Math.abs(x - rwy.x) - rwy.width / 2, 0);
  const dy = Math.max(Math.abs(y - rwy.y) - rwy.length / 2, 0);
  return Math.hypot(dx, dy);
}

// Raw hill height before the island mask and airfield flattening.
function hills(x, y) {
  return (
    95 * Math.sin(x * 0.0016 + 1.7) * Math.cos(y * 0.0013 - 0.6) +
    58 * Math.sin(x * 0.0041 + 0.3) * Math.sin(y * 0.0035 + 2.1) +
    24 * Math.sin(x * 0.011 + 4.0) * Math.cos(y * 0.009 - 1.2) +
    130 * Math.exp(-(((x - 1500) / 700) ** 2 + ((y - 500) / 900) ** 2)) + // east ridge
    110 * Math.exp(-(((x + 1350) / 620) ** 2 + ((y + 300) / 760) ** 2)) // west hill
  );
}

// Cut a glide corridor into the hills along a strip's approach path, so a
// normal 3-degree descent (or climb-out) never meets rising ground. The
// profile only ever lowers terrain, never raises it.
function glideCorridor(h, x, y, rwy, dirY) {
  const thrY = rwy.y + dirY * (rwy.length / 2); // threshold at the strip's end
  const along = (y - thrY) * dirY; // metres out from the threshold, 0..1000
  if (along < 0 || along > 1000) return h;
  const lateral = Math.abs(x - rwy.x);
  if (lateral > 170) return h;
  const blend =
    smoothstep(170, 90, lateral) * smoothstep(1000, 820, along) * smoothstep(-30, 60, along);
  const ceiling = WORLD.fieldElevation + along * 0.048;
  return h + (Math.min(h, ceiling) - h) * blend;
}

// Ground height in metres at (x, y). Below 0 is seabed; the sea sits at 0.
export function terrainHeight(x, y) {
  const dx = x - WORLD.islandCenterX;
  const dy = y - WORLD.islandCenterY;
  const r = Math.hypot(dx, dy) / WORLD.islandRadius;
  const mask = clamp(1.25 - r * r * 1.35, 0, 1);
  let h = -14 + mask * (52 + hills(x, y) * (0.35 + 0.65 * mask));
  // Flatten both airfields to their plateau so strips sit on level ground.
  for (const rwy of [WORLD.homeRunway, WORLD.farRunway]) {
    const d = runwayDistance(rwy, x, y);
    const flat = smoothstep(190, 30, d);
    h = h + (WORLD.fieldElevation - h) * flat;
  }
  // Approach corridor south of the far strip, climb-out corridor north of
  // the home strip: both flown heading north, like every landing here.
  h = glideCorridor(h, x, y, WORLD.farRunway, -1);
  h = glideCorridor(h, x, y, WORLD.homeRunway, 1);
  return h;
}

// True when (x, y) is over a runway strip, with room to spare on the edges.
export function overRunway(x, y, margin = 0) {
  for (const rwy of [WORLD.homeRunway, WORLD.farRunway]) {
    if (
      Math.abs(x - rwy.x) <= rwy.width / 2 + margin &&
      Math.abs(y - rwy.y) <= rwy.length / 2 + margin
    ) {
      return rwy;
    }
  }
  return null;
}

// Which end of a runway a landing is judged against: landings fly north.
export function runwayThreshold(rwy) {
  return { x: rwy.x, y: rwy.y - rwy.length / 2 };
}

// Patchwork field id for a ground cell: stable per 90 m square, so the
// renderer colours fields in blocks instead of per-pixel noise.
export function fieldCell(x, y) {
  const cx = Math.floor(x / 90);
  const cy = Math.floor(y / 90);
  let n = (cx * 374761393 + cy * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) % 4;
}

// Deterministic scenery: pine trees on the hills and clouds in the sky,
// placed once from the seed. Kept out of the airfield rectangles.
const scenery = { trees: [], clouds: [] };
export function buildScenery(seed) {
  const rng = makeRng(seed);
  scenery.trees.length = 0;
  scenery.clouds.length = 0;
  for (let i = 0; i < 900 && scenery.trees.length < 340; i++) {
    const x = (rng() * 2 - 1) * 2900;
    const y = WORLD.islandCenterY + (rng() * 2 - 1) * 2900;
    const h = terrainHeight(x, y);
    if (h < 10 || h > 210) continue;
    if (overRunway(x, y, 130)) continue;
    scenery.trees.push({ x, y, z: h, s: 0.75 + rng() * 0.9 });
  }
  for (let i = 0; i < 42; i++) {
    const a = rng() * Math.PI * 2;
    const r = 500 + rng() * 3600;
    scenery.clouds.push({
      x: WORLD.islandCenterX + Math.cos(a) * r,
      y: WORLD.islandCenterY + Math.sin(a) * r,
      z: 400 + rng() * 190,
      s: 60 + rng() * 130,
    });
  }
  return scenery;
}

export function getScenery() {
  return scenery;
}

// Ring orientation: each ring faces along the course, from the previous
// point (or the home strip for the first) toward the next.
export function ringFacing(index) {
  const prev =
    index === 0
      ? { x: WORLD.homeRunway.x, y: WORLD.homeRunway.y }
      : RINGS[index - 1];
  const ring = RINGS[index];
  const a = Math.atan2(ring.x - prev.x, ring.y - prev.y);
  return a;
}
