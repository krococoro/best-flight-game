// Kestrel Post — the view: chase camera, projected island, the aeroplane.
// One job: draw the world from the camera behind the plane — sky, sea,
// patchwork fields, both strips, the ring course, trees and clouds — and
// the Kestrel itself in the middle of the frame, banking with the stick.

import { COLORS, WORLD, RINGS, RING_RADIUS } from './config.js';
import { terrainHeight, getScenery, fieldCell, ringFacing } from './terrain.js';
import { clamp, wrapAngle } from './random.js';

// Camera state, smoothed toward the plane each frame so it never fights.
export function createCamera() {
  return { x: 0, y: -1600, z: 120, heading: 0, pitch: 0, roll: 0, ready: false };
}

export function updateCamera(cam, plane, dt) {
  const back = 26;
  const up = 7.5;
  const tx = plane.x - Math.sin(plane.heading) * back;
  const ty = plane.y - Math.cos(plane.heading) * back;
  const tz = plane.z + up;
  if (!cam.ready) {
    cam.x = tx; cam.y = ty; cam.z = tz;
    cam.heading = plane.heading; cam.pitch = plane.pitch; cam.roll = plane.roll * 0.55;
    cam.ready = true;
    return;
  }
  const k = 1 - Math.exp(-dt * 7);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.z += (tz - cam.z) * k;
  cam.heading += wrapAngle(plane.heading - cam.heading) * (1 - Math.exp(-dt * 9));
  cam.pitch += (plane.pitch * 0.8 - cam.pitch) * (1 - Math.exp(-dt * 6));
  cam.roll += (plane.roll * 0.55 - cam.roll) * (1 - Math.exp(-dt * 6));
}

// Perspective projector for one camera: world point -> screen point + depth.
export function makeProjector(cam, w, h) {
  const fov = 1.15; // ~66 degrees vertical
  const focal = h / 2 / Math.tan(fov / 2);
  const ch = Math.cos(cam.heading), sh = Math.sin(cam.heading);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const cr = Math.cos(cam.roll), sr = Math.sin(cam.roll);
  return function project(x, y, z) {
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    // Into heading space: fwd along the view, rgt to the right.
    let fwd = dx * sh + dy * ch;
    let rgt = dx * ch - dy * sh;
    let up = dz;
    // Pitch the view up/down.
    const f2 = fwd * cp - up * sp;
    const u2 = fwd * sp + up * cp;
    fwd = f2; up = u2;
    // Roll the picture.
    const r2 = rgt * cr - up * sr;
    const u3 = rgt * sr + up * cr;
    rgt = r2; up = u3;
    if (fwd < 0.5) return null;
    return {
      x: w / 2 + (rgt / fwd) * focal,
      y: h / 2 - (up / fwd) * focal,
      depth: fwd,
      scale: focal / fwd,
    };
  };
}

function skyGradient(ctx, cam, w, h) {
  const horizonShift = clamp(cam.pitch * 900, -260, 260);
  const g = ctx.createLinearGradient(0, -300, 0, h);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(0.45, COLORS.skyMid);
  g.addColorStop(0.62 + horizonShift / 4000, COLORS.skyLow);
  g.addColorStop(1, COLORS.seaDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Sun, low in the westering sky, with a soft glow.
  const sunX = w * 0.78, sunY = h * 0.3 + horizonShift * 0.4;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 190);
  glow.addColorStop(0, 'rgba(255,233,189,0.95)');
  glow.addColorStop(0.25, 'rgba(255,220,160,0.45)');
  glow.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = COLORS.sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 17, 0, Math.PI * 2);
  ctx.fill();
}

const FIELD_COLORS = [COLORS.fieldA, COLORS.fieldB, COLORS.fieldC, COLORS.fieldD];

function groundColor(x, y, z) {
  if (z < 1.2) return COLORS.sea;
  if (z < 4) return COLORS.sand;
  if (z > 205) return COLORS.snow;
  if (z > 150) return COLORS.rock;
  const c = fieldCell(x, y);
  // Forest patches where the field id and a slow wave agree.
  const forest = Math.sin(x * 0.0021 + 2.0) * Math.cos(y * 0.0017 - 1.0) > 0.42;
  return forest ? COLORS.forest : FIELD_COLORS[c];
}

// The terrain mesh: rows of samples ahead of the camera, drawn far to near.
function drawTerrain(ctx, cam, project, w, h) {
  const ROWS = 34, COLS = 26;
  const maxDist = 4200;
  const sinH = Math.sin(cam.heading), cosH = Math.cos(cam.heading);
  const pts = [];
  for (let r = 0; r <= ROWS; r++) {
    const t = r / ROWS;
    const dist = 4 + (maxDist - 4) * t * t;
    const half = 30 + dist * 1.15;
    const row = [];
    for (let c = 0; c <= COLS; c++) {
      const lat = -half + (2 * half * c) / COLS;
      const x = cam.x + sinH * dist + cosH * lat;
      const y = cam.y + cosH * dist - sinH * lat;
      const z = Math.max(terrainHeight(x, y), 0);
      row.push({ x, y, z, p: project(x, y, z) });
    }
    pts.push(row);
  }
  for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) {
      const a = pts[r][c], b = pts[r][c + 1], d = pts[r + 1][c + 1], e = pts[r + 1][c];
      if (!a.p || !b.p || !d.p || !e.p) continue;
      const mx = (a.x + d.x) / 2, my = (a.y + d.y) / 2, mz = (a.z + d.z) / 2;
      ctx.fillStyle = groundColor(mx, my, mz);
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(d.p.x, d.p.y);
      ctx.lineTo(e.p.x, e.p.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawRunway(ctx, project, rwy) {
  const hw = rwy.width / 2;
  const hl = rwy.length / 2;
  const corners = [
    project(rwy.x - hw, rwy.y - hl, WORLD.fieldElevation + 0.4),
    project(rwy.x + hw, rwy.y - hl, WORLD.fieldElevation + 0.4),
    project(rwy.x + hw, rwy.y + hl, WORLD.fieldElevation + 0.4),
    project(rwy.x - hw, rwy.y + hl, WORLD.fieldElevation + 0.4),
  ];
  if (corners.some((p) => !p)) return;
  ctx.fillStyle = COLORS.runway;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fill();
  // Threshold bars and a dashed centreline.
  ctx.strokeStyle = COLORS.runwayLine;
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const a = project(rwy.x + i * 3.4, rwy.y - hl + 6, WORLD.fieldElevation + 0.5);
    const b = project(rwy.x + i * 3.4, rwy.y - hl + 42, WORLD.fieldElevation + 0.5);
    if (a && b) {
      ctx.lineWidth = Math.max(1, a.scale * 1.6);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  ctx.fillStyle = COLORS.runwayLine;
  for (let s = -hl + 60; s < hl - 30; s += 44) {
    const a = project(rwy.x - 0.8, rwy.y + s, WORLD.fieldElevation + 0.5);
    const b = project(rwy.x + 0.8, rwy.y + s + 22, WORLD.fieldElevation + 0.5);
    if (a && b) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(a.x, b.y);
      ctx.closePath(); ctx.fill();
    }
  }
}

function drawRing(ctx, project, ring, index, state) {
  // state: 'next' | 'idle' | 'done'
  const c = project(ring.x, ring.y, ring.z);
  if (!c) return;
  const facing = ringFacing(index);
  // Project the ring's left and top points to size the ellipse on screen.
  const left = project(ring.x - Math.cos(facing) * RING_RADIUS, ring.y + Math.sin(facing) * RING_RADIUS, ring.z);
  const top = project(ring.x, ring.y, ring.z + RING_RADIUS);
  if (!left || !top) return;
  const radX = Math.max(2, Math.abs(left.x - c.x));
  const radY = Math.max(2, Math.abs(top.y - c.y));
  const color = state === 'done' ? COLORS.ringDone : state === 'next' ? COLORS.ringNext : COLORS.ringIdle;
  ctx.save();
  if (state === 'next') {
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = clamp(c.scale * 2.6, 2, 11);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, radX, radY, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if (state === 'next') {
    ctx.fillStyle = color;
    ctx.font = `700 ${clamp(c.scale * 9, 11, 30)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`RING ${index + 1}`, c.x, c.y - radY - 8);
  }
}

// The Kestrel, drawn from behind in screen space: cream fuselage, teal
// wings, orange trim, a blurred prop disc and a glinting canopy.
export function drawPlane(ctx, plane, w, h, time) {
  const s = Math.min(w, h) / 800; // sprite scale
  const cx = w / 2;
  const cy = h * 0.56 + Math.sin(plane.pitch) * 60 * s;
  const bank = plane.roll - 0; // sprite carries the full bank; camera took half
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-bank * 0.45);
  ctx.scale(s, s);
  // Wing shadow of motion: a soft ellipse under the plane.
  ctx.fillStyle = 'rgba(20,30,20,0.18)';
  ctx.beginPath(); ctx.ellipse(0, 64, 120, 16, 0, 0, Math.PI * 2); ctx.fill();
  // Main wing.
  ctx.fillStyle = COLORS.planeTeal;
  ctx.beginPath();
  ctx.moveTo(-168, 6); ctx.lineTo(-30, -14); ctx.lineTo(30, -14); ctx.lineTo(168, 6);
  ctx.lineTo(150, 22); ctx.lineTo(-150, 22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = COLORS.planeAccent;
  ctx.fillRect(-168, 6, 336, 5);
  // Tailplane.
  ctx.fillStyle = COLORS.planeTeal;
  ctx.beginPath();
  ctx.moveTo(-64, -52); ctx.lineTo(0, -62); ctx.lineTo(64, -52); ctx.lineTo(52, -38); ctx.lineTo(-52, -38);
  ctx.closePath(); ctx.fill();
  // Fuselage, tail to nose (nose points down-screen toward the viewer).
  const body = ctx.createLinearGradient(-26, 0, 26, 0);
  body.addColorStop(0, '#d9cba6');
  body.addColorStop(0.5, COLORS.planeCream);
  body.addColorStop(1, '#cbbd97');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-13, -86);
  ctx.quadraticCurveTo(-24, -20, -21, 26);
  ctx.quadraticCurveTo(-18, 66, 0, 74);
  ctx.quadraticCurveTo(18, 66, 21, 26);
  ctx.quadraticCurveTo(24, -20, 13, -86);
  ctx.quadraticCurveTo(0, -94, -13, -86);
  ctx.fill();
  // Fin and rudder above the tail.
  ctx.fillStyle = COLORS.planeAccent;
  ctx.beginPath();
  ctx.moveTo(0, -118); ctx.lineTo(10, -84); ctx.lineTo(-10, -84); ctx.closePath(); ctx.fill();
  // Canopy with a sky glint.
  ctx.fillStyle = '#274b5c';
  ctx.beginPath(); ctx.ellipse(0, -18, 11, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(190,230,245,0.85)';
  ctx.beginPath(); ctx.ellipse(-3.5, -26, 4, 11, -0.3, 0, Math.PI * 2); ctx.fill();
  // Prop disc at the nose: blurred circle, faster shimmer at high throttle.
  const blur = 0.1 + plane.throttle * 0.16;
  ctx.fillStyle = `rgba(230,228,220,${blur})`;
  ctx.beginPath(); ctx.ellipse(0, 76, 46, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(60,60,60,0.5)';
  ctx.lineWidth = 2;
  const pa = time * (6 + plane.throttle * 55);
  ctx.beginPath();
  ctx.moveTo(Math.cos(pa) * -44, 76 + Math.sin(pa) * 9);
  ctx.lineTo(Math.cos(pa) * 44, 76 - Math.sin(pa) * 9);
  ctx.stroke();
  ctx.fillStyle = COLORS.planeAccent;
  ctx.beginPath(); ctx.arc(0, 76, 6, 0, Math.PI * 2); ctx.fill();
  // Fixed gear legs and wheels.
  ctx.strokeStyle = '#3c4043';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-14, 30); ctx.lineTo(-30, 58);
  ctx.moveTo(14, 30); ctx.lineTo(30, 58);
  ctx.stroke();
  ctx.fillStyle = '#22252a';
  ctx.beginPath(); ctx.arc(-31, 62, 8, 0, Math.PI * 2); ctx.arc(31, 62, 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Whole scene, back to front.
export function drawScene(ctx, cam, plane, sortie, w, h, time) {
  const project = makeProjector(cam, w, h);
  skyGradient(ctx, cam, w, h);
  drawSceneryCloudsOnly(ctx, project);
  drawTerrain(ctx, cam, project, w, h);
  drawRunway(ctx, project, WORLD.homeRunway);
  drawRunway(ctx, project, WORLD.farRunway);
  for (let i = RINGS.length - 1; i >= 0; i--) {
    const state = i < sortie.nextRing ? 'done' : i === sortie.nextRing ? 'next' : 'idle';
    drawRing(ctx, project, RINGS[i], i, state);
  }
  drawSceneryTreesOnly(ctx, project, plane);
  drawPlane(ctx, plane, w, h, time);
}

function drawSceneryCloudsOnly(ctx, project) {
  const { clouds } = getScenery();
  for (const cl of clouds) {
    const p = project(cl.x, cl.y, cl.z);
    if (!p || p.depth > 5200) continue;
    const s = cl.s * p.scale;
    if (s < 3) continue;
    ctx.fillStyle = 'rgba(255,250,240,0.82)';
    for (const [ox, oy, os] of [[0, 0, 1], [-0.55, 0.12, 0.62], [0.55, 0.1, 0.7], [0.1, -0.22, 0.55]]) {
      ctx.beginPath();
      ctx.ellipse(p.x + ox * s, p.y + oy * s * 0.4, s * os, s * os * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSceneryTreesOnly(ctx, project, plane) {
  const { trees } = getScenery();
  const near = [];
  for (const t of trees) {
    const d = Math.hypot(t.x - plane.x, t.y - plane.y);
    if (d < 1500) near.push([d, t]);
  }
  near.sort((a, b) => b[0] - a[0]);
  for (const [, t] of near) {
    const base = project(t.x, t.y, t.z);
    if (!base) continue;
    const hgt = 13 * t.s * base.scale;
    if (hgt < 2) continue;
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(base.x - hgt * 0.05, base.y - hgt * 0.3, hgt * 0.1, hgt * 0.3);
    ctx.fillStyle = COLORS.forest;
    for (let tier = 0; tier < 3; tier++) {
      const tw = hgt * (0.62 - tier * 0.16);
      const ty = base.y - hgt * (0.25 + tier * 0.26);
      ctx.beginPath();
      ctx.moveTo(base.x - tw / 2, ty);
      ctx.lineTo(base.x + tw / 2, ty);
      ctx.lineTo(base.x, ty - hgt * 0.42);
      ctx.closePath();
      ctx.fill();
    }
  }
}
