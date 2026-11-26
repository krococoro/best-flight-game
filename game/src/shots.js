// Kestrel Post — screenshot scenes: frozen, deterministic set-ups.
// One job: when the page is opened with ?shot=<name>, place the plane, the
// sortie and the camera in an exact mid-flight moment so the maker's
// screenshots are real renders of the game in known states, every time.

import { createPlane, createSortie, PHASE } from './flight.js';
import { createCamera } from './render.js';

function snapCamera(cam, plane) {
  cam.x = plane.x - Math.sin(plane.heading) * 26;
  cam.y = plane.y - Math.cos(plane.heading) * 26;
  cam.z = plane.z + 7.5;
  cam.heading = plane.heading;
  cam.pitch = plane.pitch * 0.8;
  cam.roll = plane.roll * 0.55;
  cam.ready = true;
}

function base() {
  return { plane: createPlane(), sortie: createSortie(), cam: createCamera() };
}

function airborne(plane, sortie, fields) {
  Object.assign(plane, fields);
  plane.onGround = false;
  sortie.phase = PHASE.FLYING;
  return plane;
}

// The cover: mid-course, gold ring ahead over the patchwork, panel lit.
function coverScene() {
  const { plane, sortie, cam } = base();
  airborne(plane, sortie, {
    x: 287, y: -157, z: 220, heading: 0.447, pitch: 0.02, roll: 0.14,
    speed: 38, throttle: 0.62, vspeed: 0.8,
  });
  sortie.nextRing = 2;
  sortie.ringsFlown = 2;
  sortie.score = 640;
  sortie.fuel = 78;
  sortie.time = 96;
  sortie.lastRingAt = 88;
  snapCamera(cam, plane);
  return { plane, sortie, cam, name: 'cover' };
}

// A banked pass close under the fifth ring, island spread out below.
function ringsScene() {
  const { plane, sortie, cam } = base();
  airborne(plane, sortie, {
    x: 4, y: 946, z: 236, heading: -0.785, pitch: 0.03, roll: -0.52,
    speed: 44, throttle: 0.7, vspeed: 1.1,
  });
  sortie.nextRing = 4;
  sortie.ringsFlown = 4;
  sortie.score = 1290;
  sortie.fuel = 64;
  sortie.time = 168;
  sortie.lastRingAt = 160;
  snapCamera(cam, plane);
  return { plane, sortie, cam, name: 'rings' };
}

// Final approach: all rings flown, the far strip filling the windscreen.
function landingScene() {
  const { plane, sortie, cam } = base();
  airborne(plane, sortie, {
    x: 243, y: 1560, z: 132, heading: 0.02, pitch: -0.055, roll: 0.03,
    speed: 27, throttle: 0.24, vspeed: -2.6,
  });
  sortie.nextRing = 8;
  sortie.ringsFlown = 8;
  sortie.score = 2380;
  sortie.fuel = 31;
  sortie.time = 252;
  sortie.lastRingAt = 210;
  snapCamera(cam, plane);
  return { plane, sortie, cam, name: 'landing' };
}

// Parked at the home threshold at golden hour, ready for the title card.
function titleScene() {
  const { plane, sortie, cam } = base();
  plane.throttle = 0.12;
  sortie.phase = PHASE.PARKED;
  snapCamera(cam, plane);
  return { plane, sortie, cam, name: 'title' };
}

const SCENES = {
  cover: coverScene,
  rings: ringsScene,
  landing: landingScene,
  title: titleScene,
};

export function shotScene(name) {
  const make = SCENES[name];
  return make ? make() : null;
}
