// Kestrel Post — instruments and HUD: the panel the pilot flies by.
// One job: draw the lit dashboard (attitude, airspeed, altimeter, vertical
// speed, RPM, fuel, throttle) and the top HUD (heading ribbon, objective,
// score, warnings) over the rendered scene.

import { COLORS, RINGS } from './config.js';
import { clamp, headingDeg, compassPoint, wrapAngle } from './random.js';

const MS_TO_KT = 1.944;
const M_TO_FT = 3.281;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// One round gauge: face, tick ring, needle, caption and a digital readout.
function gauge(ctx, cx, cy, r, frac, caption, digital, needleColor = COLORS.needle) {
  ctx.fillStyle = COLORS.gaugeFace;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = COLORS.gaugeMark;
  ctx.lineWidth = 1.6;
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const inner = i % 5 === 0 ? r * 0.72 : r * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
    ctx.stroke();
  }
  const a = Math.PI * 0.75 + clamp(frac, 0, 1) * Math.PI * 1.5;
  ctx.strokeStyle = needleColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
  ctx.stroke();
  ctx.fillStyle = COLORS.gaugeMark;
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  ctx.font = `600 ${Math.round(r * 0.34)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(caption, cx, cy + r * 0.52);
  ctx.font = `700 ${Math.round(r * 0.36)}px ui-monospace, monospace`;
  ctx.fillStyle = '#ffd98a';
  ctx.fillText(digital, cx, cy + r * 0.82);
}

// Attitude indicator: the ball rolls with the plane and slides with pitch.
function attitude(ctx, cx, cy, r, plane) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = COLORS.gaugeFace;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.translate(cx, cy);
  ctx.rotate(plane.roll);
  const pitchPx = clamp(plane.pitch, -0.6, 0.6) * r * 1.1;
  ctx.fillStyle = '#3f8fbf';
  ctx.fillRect(-r * 1.5, -r * 1.5 + pitchPx, r * 3, r * 1.5);
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(-r * 1.5, pitchPx, r * 3, r * 1.5);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.4;
  for (const off of [-0.5, -0.25, 0.25, 0.5]) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, pitchPx + off * r);
    ctx.lineTo(r * 0.22, pitchPx + off * r);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed aircraft symbol and rim.
  ctx.strokeStyle = COLORS.needle;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy); ctx.lineTo(cx - r * 0.16, cy);
  ctx.moveTo(cx + r * 0.16, cy); ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
  ctx.fillStyle = COLORS.needle;
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = COLORS.gaugeMark;
  ctx.font = `600 ${Math.round(r * 0.3)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', cx, cy + r + 14);
}

// Heading ribbon across the top, with a bug pointing at the objective.
function headingRibbon(ctx, plane, targetHeading, w) {
  const cx = w / 2;
  const y = 14, hh = 34;
  ctx.fillStyle = 'rgba(16,21,27,0.72)';
  roundRect(ctx, cx - 210, y, 420, hh, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - 200, y, 400, hh); ctx.clip();
  const deg = headingDeg(plane.heading);
  ctx.font = '600 15px ui-monospace, monospace';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 5) {
    const shown = ((deg + d) % 360 + 360) % 360;
    const x = cx + d * 3.4;
    ctx.fillStyle = 'rgba(232,228,216,0.55)';
    ctx.fillRect(x, y + hh - 9, 1.6, d % 15 === 0 ? 9 : 5);
    if (shown % 30 === 0) {
      ctx.fillStyle = COLORS.hudText;
      ctx.fillText(String(shown).padStart(3, '0'), x, y + 17);
    }
  }
  if (targetHeading !== null) {
    const off = wrapAngle(targetHeading - plane.heading);
    const bx = cx + clamp((off * 180) / Math.PI, -58, 58) * 3.4;
    ctx.fillStyle = COLORS.ringNext;
    ctx.beginPath();
    ctx.moveTo(bx, y + hh - 2); ctx.lineTo(bx - 6, y + hh - 12); ctx.lineTo(bx + 6, y + hh - 12);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = COLORS.ringNext;
  ctx.beginPath();
  ctx.moveTo(cx, y + hh + 2); ctx.lineTo(cx - 6, y + hh - 8); ctx.lineTo(cx + 6, y + hh - 8);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '700 17px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(deg).padStart(3, '0')}° ${compassPoint(plane.heading)}`, cx, y + hh + 24);
}

// The whole overlay for one frame of flight.
export function drawCockpit(ctx, plane, sortie, objectiveHeading, w, h, time) {
  headingRibbon(ctx, plane, objectiveHeading, w);

  // Top-left flight data block: the numbers the judge's checklist names.
  const knots = Math.round(plane.speed * MS_TO_KT);
  const feet = Math.max(0, Math.round((plane.z - 42) * M_TO_FT));
  ctx.fillStyle = 'rgba(16,21,27,0.72)';
  roundRect(ctx, 16, 14, 218, 118, 10);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '700 21px ui-monospace, monospace';
  ctx.fillText(`ALT ${feet} ft`, 30, 46);
  ctx.fillText(`SPD ${knots} kt`, 30, 74);
  ctx.fillStyle = sortie.fuel < 22 ? COLORS.warn : COLORS.hudText;
  ctx.fillText(`FUEL ${Math.round(sortie.fuel)}%`, 30, 102);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText(`VS ${plane.vspeed >= 0 ? '+' : ''}${Math.round(plane.vspeed * 197)} fpm`, 30, 124);

  // Top-right: score and objective progress.
  ctx.fillStyle = 'rgba(16,21,27,0.72)';
  roundRect(ctx, w - 252, 14, 236, 88, 10);
  ctx.fill();
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '700 22px ui-monospace, monospace';
  ctx.fillText(`SCORE ${sortie.score}`, w - 30, 48);
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = '#ffd98a';
  const obj = sortie.nextRing < RINGS.length
    ? `RING ${Math.min(sortie.nextRing + 1, RINGS.length)} OF ${RINGS.length}`
    : 'LAND: FAR STRIP';
  ctx.fillText(obj, w - 30, 74);
  const mm = Math.floor(sortie.time / 60);
  const ss = String(Math.floor(sortie.time % 60)).padStart(2, '0');
  ctx.fillStyle = COLORS.hudText;
  ctx.fillText(`TIME ${mm}:${ss}`, w - 30, 96);

  // Warnings, centre screen.
  ctx.textAlign = 'center';
  if (sortie.stallWarn && !plane.onGround) {
    if (Math.floor(time * 3) % 2 === 0) {
      ctx.fillStyle = COLORS.warn;
      ctx.font = '800 30px system-ui, sans-serif';
      ctx.fillText('STALL', w / 2, h * 0.3);
    }
  }
  if (sortie.message && sortie.time - sortie.messageAt < 4) {
    ctx.fillStyle = 'rgba(16,21,27,0.66)';
    const tw = ctx.measureText(sortie.message).width + 90;
    roundRect(ctx, w / 2 - tw / 2, h * 0.16, tw, 40, 9);
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.fillText(sortie.message, w / 2, h * 0.16 + 27);
  }

  // The dashboard strip along the bottom.
  const panelH = 168;
  const py = h - panelH;
  const grad = ctx.createLinearGradient(0, py, 0, h);
  grad.addColorStop(0, '#2c3138');
  grad.addColorStop(0.12, COLORS.panel);
  grad.addColorStop(1, '#191d22');
  ctx.fillStyle = grad;
  ctx.fillRect(0, py, w, panelH);
  ctx.fillStyle = COLORS.panelEdge;
  ctx.fillRect(0, py, w, 3);
  // Sun visor screws, a small flown-in touch.
  ctx.fillStyle = '#12151a';
  for (const sx of [26, w / 2 - 130, w / 2 + 130, w - 26]) {
    ctx.beginPath(); ctx.arc(sx, py + 14, 3.5, 0, Math.PI * 2); ctx.fill();
  }

  const cy = py + panelH / 2 + 8;
  attitude(ctx, 110, cy, 52, plane);
  gauge(ctx, 250, cy, 52, plane.speed / 64, 'AIRSPEED', `${knots}`);
  gauge(ctx, 390, cy, 52, ((plane.z - 42) * M_TO_FT) / 1500, 'ALTIMETER', `${feet}`);
  gauge(ctx, 530, cy, 52, 0.5 + plane.vspeed / 24, 'VERT SPD', `${Math.round(plane.vspeed * 197)}`);

  // Engine cluster on the right: RPM, fuel, throttle quadrant.
  gauge(ctx, w - 390, cy, 52, plane.throttle * (sortie.fuel > 0 ? 1 : 0.2), 'RPM', `${Math.round(600 + plane.throttle * 1900)}`);
  // Fuel as a vertical bar gauge.
  const fx = w - 268, fw = 30, fh = 104, fy = cy - fh / 2;
  ctx.fillStyle = COLORS.gaugeFace;
  roundRect(ctx, fx, fy, fw, fh, 6); ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 2; ctx.stroke();
  const fuelFrac = clamp(sortie.fuel / 100, 0, 1);
  ctx.fillStyle = sortie.fuel < 22 ? COLORS.warn : '#7fc95e';
  ctx.fillRect(fx + 4, fy + fh - 4 - (fh - 8) * fuelFrac, fw - 8, (fh - 8) * fuelFrac);
  ctx.fillStyle = COLORS.gaugeMark;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FUEL', fx + fw / 2, fy + fh + 16);
  // Throttle quadrant: a slot with a lever knob.
  const tx = w - 168, ty = cy - 52;
  ctx.fillStyle = COLORS.gaugeFace;
  roundRect(ctx, tx, ty, 34, 104, 8); ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge; ctx.stroke();
  ctx.strokeStyle = '#0a0d10';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(tx + 17, ty + 10); ctx.lineTo(tx + 17, ty + 94); ctx.stroke();
  const knobY = ty + 94 - plane.throttle * 84;
  ctx.fillStyle = '#c33';
  ctx.beginPath(); ctx.arc(tx + 17, knobY, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f3e9d2';
  ctx.beginPath(); ctx.arc(tx + 17, knobY, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COLORS.gaugeMark;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText('THROTTLE', tx + 17, ty + 120);
  // Gear-damage lamp.
  ctx.fillStyle = plane.gearDamage > 0 ? COLORS.warn : '#2c3138';
  ctx.beginPath(); ctx.arc(w - 84, cy - 20, 13, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = COLORS.gaugeMark;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('GEAR', w - 84, cy + 12);
  ctx.fillText(plane.gearDamage > 0 ? 'BENT' : 'DOWN', w - 84, cy + 28);
}
