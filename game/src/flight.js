// Kestrel Post — the aeroplane and the sortie: physics, phases, scoring.
// One job: advance the plane one fixed step at a time from stick, throttle
// and rudder inputs, and judge the flight (rings, landings, crashes).

import { WORLD, RINGS, RING_RADIUS, PLANE, SCORE } from './config.js';
import { terrainHeight, overRunway } from './terrain.js';
import { clamp, wrapAngle } from './random.js';

export const PHASE = {
  PARKED: 'parked', // on the home strip, engine idling
  FLYING: 'flying', // airborne, working the ring course
  LANDED: 'landed', // rolled to a stop on the far strip: sortie complete
  CRASHED: 'crashed',
  STOPPED: 'stopped', // rolled to a stop somewhere that is not the far strip
};

export function createPlane() {
  const rwy = WORLD.homeRunway;
  return {
    x: rwy.x,
    y: rwy.y - rwy.length / 2 + 60, // parked at the threshold, facing north
    z: WORLD.fieldElevation,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    vspeed: 0,
    onGround: true,
    gearDamage: 0,
  };
}

export function createSortie() {
  return {
    phase: PHASE.PARKED,
    time: 0,
    fuel: PLANE.tankSize,
    nextRing: 0,
    ringsFlown: 0,
    score: 0,
    ringTimes: [],
    lastRingAt: 0,
    message: '',
    messageAt: -10,
    touchdown: null, // { sink, speed, aligned, rwy } when the wheels meet ground
    stallWarn: false,
    flameout: false,
    landedAt: 0,
  };
}

function say(sortie, text) {
  sortie.message = text;
  sortie.messageAt = sortie.time;
}

// One fixed step. input: { pitch: -1..1 (pull back positive), roll: -1..1
// (right positive), throttleDelta: -1..1, brake: bool }.
export function stepFlight(plane, sortie, input, dt) {
  if (sortie.phase === PHASE.CRASHED || sortie.phase === PHASE.LANDED) return;
  sortie.time += dt;

  // Throttle lever and fuel.
  plane.throttle = clamp(plane.throttle + input.throttleDelta * dt * 0.7, 0, 1);
  const burn = PLANE.fuelBurn * plane.throttle * dt;
  if (sortie.fuel > 0) {
    sortie.fuel = Math.max(0, sortie.fuel - burn);
    if (sortie.fuel === 0 && !sortie.flameout) {
      sortie.flameout = true;
      say(sortie, 'OUT OF FUEL — glide for the far strip');
    }
  }
  const power = sortie.fuel > 0 ? plane.throttle : 0;

  // Stick: pitch and roll ease toward the commanded attitude.
  const targetRoll = input.roll * PLANE.maxRoll;
  plane.roll += clamp(targetRoll - plane.roll, -PLANE.rollRate * dt, PLANE.rollRate * dt);
  if (plane.onGround) {
    // On the strip the nose only lifts past rotate speed.
    const want = input.pitch > 0 && plane.speed > PLANE.rotateSpeed ? 0.16 : 0;
    plane.pitch += clamp(want - plane.pitch, -1.2 * dt, 1.2 * dt);
  } else {
    const targetPitch = input.pitch * 0.5;
    plane.pitch += clamp(targetPitch - plane.pitch, -PLANE.pitchRate * dt, PLANE.pitchRate * dt);
  }

  // Heading follows bank; a wing dropped on the ground does nothing.
  if (!plane.onGround) {
    const turnRate = Math.sin(plane.roll) * (PLANE.turnGain / Math.max(plane.speed, 12));
    plane.heading = wrapAngle(plane.heading + turnRate * dt);
  } else if (plane.speed > 3) {
    plane.heading = wrapAngle(plane.heading + input.roll * 0.25 * dt * (plane.speed / 20));
  }

  // Speed: thrust against drag, plus gravity trading height for speed.
  const drag = PLANE.dragBase * plane.speed * plane.speed +
    PLANE.dragInduced * Math.abs(input.pitch) * plane.speed;
  let accel = power * PLANE.maxThrust - drag / Math.max(plane.speed, 4) * 3.2;
  if (!plane.onGround) accel -= Math.sin(plane.pitch) * PLANE.gravity * 0.82;
  plane.speed = clamp(plane.speed + accel * dt, 0, PLANE.maxSpeed);
  if (plane.onGround && input.brake) {
    plane.speed = Math.max(0, plane.speed - 9 * dt);
  }

  // Move along heading and pitch; lift holds the plane up above stall speed
  // and lets it sink below it, which is what makes throttle discipline pay.
  const vx = Math.sin(plane.heading) * Math.cos(plane.pitch) * plane.speed;
  const vy = Math.cos(plane.heading) * Math.cos(plane.pitch) * plane.speed;
  let vz = Math.sin(plane.pitch) * plane.speed;
  if (!plane.onGround) {
    const liftShortfall = clamp((PLANE.stallSpeed - plane.speed) / PLANE.stallSpeed, 0, 1);
    vz -= liftShortfall * liftShortfall * 11;
    sortie.stallWarn = plane.speed < PLANE.stallSpeed + 2.5 && plane.speed > 1;
  } else {
    sortie.stallWarn = false;
  }
  plane.x += vx * dt;
  plane.y += vy * dt;
  plane.z += vz * dt;
  plane.vspeed = vz;

  // Ground contact. While rolling, the plane lifts off the moment pitch,
  // speed and a strip under the wheels say so — checked before the ground
  // clamp, because a lifting nose raises z off the strip in the same step.
  const ground = terrainHeight(plane.x, plane.y);
  const rwy = overRunway(plane.x, plane.y);
  const floorZ = rwy ? WORLD.fieldElevation : ground;
  if (plane.onGround) {
    const canLift = plane.pitch > 0.05 && plane.speed > PLANE.rotateSpeed && rwy && vz > 0;
    if (canLift) {
      plane.onGround = false;
      if (sortie.phase === PHASE.PARKED) {
        sortie.phase = PHASE.FLYING;
        sortie.lastRingAt = sortie.time;
        say(sortie, 'Airborne! Follow the gold ring');
      }
    } else if (plane.z > floorZ + 1.5) {
      plane.onGround = false; // rolled off a drop in the ground
    } else {
      plane.z = floorZ;
    }
  } else if (plane.z <= floorZ) {
    plane.z = floorZ;
    touchDown(plane, sortie, rwy, vz);
  }
}

function touchDown(plane, sortie, rwy, sinkAtContact) {
  const sink = -sinkAtContact;
  const aligned = Math.abs(wrapAngle(plane.heading - (rwy ? rwy.heading : 0))) < 0.3;
  sortie.touchdown = { sink, speed: plane.speed, aligned, rwy: rwy || null };
  if (sink > 7.5 || !rwy) {
    sortie.phase = PHASE.CRASHED;
    plane.gearDamage = 1;
    say(sortie, sink > 7.5 ? 'Hard arrival — the Kestrel is bent' : 'Down in the rough — sortie over');
    return;
  }
  if (sink > 4.2) {
    plane.gearDamage = Math.min(1, plane.gearDamage + 0.45);
    say(sortie, 'Firm landing — gear groaning');
  }
  plane.onGround = true;
  plane.pitch = 0;
  plane.roll = 0;
  if (rwy === WORLD.farRunway && sortie.ringsFlown >= RINGS.length) {
    // The sortie ends when the roll-out stops on the far strip.
    sortie.phase = PHASE.STOPPED;
    sortie.landedAt = sortie.time;
    say(sortie, 'Mail delivered — roll to a stop');
  } else if (rwy === WORLD.farRunway) {
    say(sortie, 'This is the far strip — finish the rings first');
  } else {
    say(sortie, 'Back on the home strip');
  }
}

// Ring judging: called each step while flying; a ring counts when the plane
// passes through its disc, roughly facing along the course.
export function checkRing(plane, sortie) {
  if (sortie.phase !== PHASE.FLYING || sortie.nextRing >= RINGS.length) return false;
  const ring = RINGS[sortie.nextRing];
  const dx = plane.x - ring.x;
  const dy = plane.y - ring.y;
  const dz = plane.z - ring.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > RING_RADIUS) return false;
  const legTime = sortie.time - sortie.lastRingAt;
  const timeBonus = Math.max(0, Math.round(SCORE.ringTimeBonusMax - legTime * 1.5));
  sortie.score += SCORE.ring + timeBonus;
  sortie.ringTimes.push(legTime);
  sortie.lastRingAt = sortie.time;
  sortie.ringsFlown += 1;
  sortie.nextRing += 1;
  if (sortie.nextRing >= RINGS.length) {
    say(sortie, `Last ring! +${SCORE.ring + timeBonus} — land on the far strip, north end of the island`);
  } else {
    say(sortie, `Ring ${sortie.ringsFlown}/${RINGS.length}  +${SCORE.ring + timeBonus}`);
  }
  return true;
}

// Final scoring once the plane has stopped on the far strip.
export function finishSortie(plane, sortie) {
  if (sortie.phase !== PHASE.STOPPED) return null;
  const td = sortie.touchdown || { sink: 3, speed: 30, aligned: true };
  const smooth = clamp(1 - Math.max(0, td.sink - 1.2) / 4.5, 0, 1);
  const landingScore = SCORE.landingBase + Math.round(SCORE.smoothLandingBonus * smooth);
  const fuelScore = Math.round(sortie.fuel * SCORE.fuelBonusPerUnit);
  const total = sortie.score + landingScore + fuelScore;
  sortie.phase = PHASE.LANDED;
  return {
    ringScore: sortie.score,
    landingScore,
    fuelScore,
    total,
    sink: td.sink,
    ringsFlown: sortie.ringsFlown,
    time: sortie.time,
    gearDamage: plane.gearDamage,
  };
}
