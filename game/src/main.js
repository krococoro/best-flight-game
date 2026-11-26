// Kestrel Post — the game itself: loop, screens and wiring.
// One job: run the fixed-step simulation, draw scene + cockpit + screens,
// and carry the player from title to take-off, rings, landing and report.

import { STAGE_W, STAGE_H, STEP, RINGS, WORLD } from './config.js';
import { buildScenery } from './terrain.js';
import { createPlane, createSortie, stepFlight, checkRing, finishSortie, PHASE } from './flight.js';
import { createCamera, updateCamera, drawScene } from './render.js';
import { drawCockpit } from './cockpit.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { shotScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 20261126);
buildScenery(seed);

const input = createInput(canvas);
const audio = createAudio();

let plane = createPlane();
let sortie = createSortie();
let cam = createCamera();
let mode = 'title'; // title | flying | paused | over
let report = null;
let crashTimer = 0;
let wasAirborne = false;
let best = Number(localStorage.getItem('kestrel-post-best') || 0);

// Fit the 1280x800 stage into the window without stretching.
function fitCanvas() {
  const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  canvas.style.width = `${Math.floor(STAGE_W * scale)}px`;
  canvas.style.height = `${Math.floor(STAGE_H * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function resetSortie() {
  plane = createPlane();
  sortie = createSortie();
  cam = createCamera();
  report = null;
  crashTimer = 0;
  wasAirborne = false;
}

// Heading from the plane to the current objective, for the ribbon bug.
function objectiveHeading() {
  let target = null;
  if (sortie.nextRing < RINGS.length) target = RINGS[sortie.nextRing];
  else target = { x: WORLD.farRunway.x, y: WORLD.farRunway.y - WORLD.farRunway.length / 2 };
  return Math.atan2(target.x - plane.x, target.y - plane.y);
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function stepSimulation(dt) {
  const inp = input.flight();
  const wasOnGround = plane.onGround;
  stepFlight(plane, sortie, inp, dt);
  if (wasOnGround && !plane.onGround) {
    wasAirborne = true;
    announce('Airborne. Fly the ring course, then land on the far strip.');
  }
  if (!wasOnGround && plane.onGround && sortie.phase !== PHASE.CRASHED) {
    audio.thud();
  }
  if (checkRing(plane, sortie)) audio.ring();
  if (sortie.phase === PHASE.CRASHED) {
    crashTimer += dt;
    if (crashTimer === dt) audio.crash();
    if (crashTimer > 1.4) {
      mode = 'over';
      announce('Crashed. Press R to fly again.');
    }
  }
  if (sortie.phase === PHASE.STOPPED && plane.speed < 0.4) {
    plane.speed = 0;
    report = finishSortie(plane, sortie);
    if (report) {
      if (report.total > best) {
        best = report.total;
        localStorage.setItem('kestrel-post-best', String(best));
      }
      audio.fanfare();
      mode = 'over';
      announce(`Sortie complete. Score ${report.total}. Press R to fly again.`);
    }
  }
}

function panel(x, y, w, h, r = 14) {
  ctx.fillStyle = 'rgba(14,18,24,0.82)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,217,138,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawTitle() {
  panel(STAGE_W / 2 - 330, 120, 660, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = '800 64px system-ui, sans-serif';
  ctx.fillText('KESTREL POST', STAGE_W / 2, 205);
  ctx.fillStyle = '#fdf6e3';
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillText('Island Mail Run', STAGE_W / 2, 244);
  ctx.font = '400 17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(253,246,227,0.85)';
  ctx.fillText('Take off, thread all eight rings, and put the mail down', STAGE_W / 2, 288);
  ctx.fillText('on the far strip — gently, with fuel to spare.', STAGE_W / 2, 312);
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillStyle = '#ffd98a';
  ctx.fillText('SHIFT throttle up · CTRL down · W/S or ↑/↓ pitch · A/D or ←/→ bank · B brake', STAGE_W / 2, 352);
  ctx.fillStyle = '#fdf6e3';
  ctx.font = '700 21px system-ui, sans-serif';
  ctx.fillText('Press ENTER or click to fly', STAGE_W / 2, 392);
  if (best > 0) {
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(253,246,227,0.75)';
    ctx.fillText(`Best sortie: ${best}`, STAGE_W / 2, 448);
  }
}

function drawOver() {
  panel(STAGE_W / 2 - 300, 150, 600, 380);
  ctx.textAlign = 'center';
  if (sortie.phase === PHASE.CRASHED) {
    ctx.fillStyle = '#ff8a7a';
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.fillText('SORTIE OVER', STAGE_W / 2, 225);
    ctx.fillStyle = '#fdf6e3';
    ctx.font = '400 19px system-ui, sans-serif';
    ctx.fillText(sortie.message || 'The Kestrel came down in the rough.', STAGE_W / 2, 275);
    ctx.fillText(`Rings flown: ${sortie.ringsFlown} of ${RINGS.length} · Score kept: ${sortie.score}`, STAGE_W / 2, 312);
  } else if (report) {
    ctx.fillStyle = '#ffd98a';
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.fillText('MAIL DELIVERED', STAGE_W / 2, 225);
    ctx.fillStyle = '#fdf6e3';
    ctx.font = '400 19px ui-monospace, monospace';
    const lines = [
      `Rings ${report.ringsFlown}/${RINGS.length}        ${report.ringScore}`,
      `Landing          ${report.landingScore}`,
      `Fuel bonus       ${report.fuelScore}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, STAGE_W / 2, 282 + i * 32));
    ctx.font = '700 26px ui-monospace, monospace';
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(`TOTAL  ${report.total}`, STAGE_W / 2, 396);
    ctx.font = '400 16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(253,246,227,0.8)';
    const touch = report.sink < 2 ? 'a greaser' : report.sink < 4.2 ? 'firm but fair' : 'a heavy arrival';
    ctx.fillText(`Touchdown: ${touch} · Air time ${Math.floor(report.time / 60)}:${String(Math.floor(report.time % 60)).padStart(2, '0')}`, STAGE_W / 2, 428);
  }
  ctx.fillStyle = '#fdf6e3';
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText('Press R or click to fly again', STAGE_W / 2, 492);
}

function drawPaused() {
  ctx.fillStyle = 'rgba(10,14,18,0.45)';
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fdf6e3';
  ctx.font = '800 46px system-ui, sans-serif';
  ctx.fillText('PAUSED', STAGE_W / 2, STAGE_H / 2);
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText('Press P to resume', STAGE_W / 2, STAGE_H / 2 + 36);
}

// Screenshot mode: a frozen scene, re-rendered identically each frame.
const shot = params.get('shot') ? shotScene(params.get('shot')) : null;
if (shot) {
  const isTitle = shot.name === 'title';
  function renderShot() {
    drawScene(ctx, shot.cam, shot.plane, shot.sortie, STAGE_W, STAGE_H, 3.2);
    if (!isTitle) {
      const target = shot.sortie.nextRing < RINGS.length
        ? RINGS[shot.sortie.nextRing]
        : { x: WORLD.farRunway.x, y: WORLD.farRunway.y - WORLD.farRunway.length / 2 };
      const heading = Math.atan2(target.x - shot.plane.x, target.y - shot.plane.y);
      drawCockpit(ctx, shot.plane, shot.sortie, heading, STAGE_W, STAGE_H, 3.2);
    } else {
      drawTitle();
    }
    requestAnimationFrame(renderShot);
  }
  renderShot();
} else {
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const click = input.takeClick();

    if (mode === 'title') {
      // The parked Kestrel on its strip, panel dark, title over it.
      updateCamera(cam, plane, dt);
      drawScene(ctx, cam, plane, sortie, STAGE_W, STAGE_H, now / 1000);
      drawTitle();
      if (input.tapped('Enter') || click) {
        audio.start();
        audio.click();
        mode = 'flying';
        announce('Rolling. Shift for throttle, pull back at 40 knots.');
      }
    } else if (mode === 'flying' || mode === 'paused') {
      if (input.tapped('KeyP')) mode = mode === 'flying' ? 'paused' : 'flying';
      if (mode === 'flying') {
        accumulator += dt;
        while (accumulator >= STEP) {
          stepSimulation(STEP);
          accumulator -= STEP;
          if (mode !== 'flying') { accumulator = 0; break; }
        }
        updateCamera(cam, plane, dt);
      }
      drawScene(ctx, cam, plane, sortie, STAGE_W, STAGE_H, now / 1000);
      drawCockpit(ctx, plane, sortie, objectiveHeading(), STAGE_W, STAGE_H, now / 1000);
      if (mode === 'paused') drawPaused();
      audio.update(plane, mode === 'flying');
    } else if (mode === 'over') {
      updateCamera(cam, plane, dt);
      drawScene(ctx, cam, plane, sortie, STAGE_W, STAGE_H, now / 1000);
      drawCockpit(ctx, plane, sortie, objectiveHeading(), STAGE_W, STAGE_H, now / 1000);
      drawOver();
      audio.update(plane, false);
      if (input.tapped('KeyR') || click) {
        audio.click();
        resetSortie();
        mode = 'flying';
        announce('Rolling again.');
      }
    }
    input.clearPressed();
  }
  requestAnimationFrame(frame);
}
