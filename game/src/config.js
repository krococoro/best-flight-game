// Kestrel Post — shared constants: palette, world layout, physics tuning.
// One job: every number the other modules agree on lives here.

// Canvas is laid out for a 1280x800 stage and scaled to the window.
export const STAGE_W = 1280;
export const STAGE_H = 800;

// Golden-hour palette: one warm light over a green island in a teal sea.
export const COLORS = {
  skyTop: '#3d7ca8',
  skyMid: '#8fc3dd',
  skyLow: '#f7cf9a',
  sunGlow: '#ffe9bd',
  sea: '#2e7d8c',
  seaDeep: '#256b7a',
  sand: '#e3cf9e',
  fieldA: '#79a84b',
  fieldB: '#93b95c',
  fieldC: '#c2a95c',
  fieldD: '#6f9e57',
  forest: '#3f7040',
  rock: '#8d8578',
  snow: '#f4efe4',
  runway: '#5b5f66',
  runwayLine: '#f5f2e6',
  ringDone: '#7fd4a8',
  ringNext: '#ffb52e',
  ringIdle: '#39c2c9',
  planeCream: '#f3e9d2',
  planeTeal: '#14707e',
  planeAccent: '#e8762c',
  panel: '#23272e',
  panelEdge: '#3a4048',
  gaugeFace: '#10151b',
  gaugeMark: '#e8e4d8',
  needle: '#ffb52e',
  hudText: '#fdf6e3',
  warn: '#ff5347',
  good: '#7fe0a0',
};

// World layout (metres: x east, y north, z up). Two grass-and-asphalt strips
// on one island, a ring course winding between them.
export const WORLD = {
  islandCenterX: 0,
  islandCenterY: 300,
  islandRadius: 3300,
  fieldElevation: 42,
  homeRunway: { x: 0, y: -1400, length: 520, width: 32, heading: 0 },
  farRunway: { x: 250, y: 2350, length: 560, width: 32, heading: 0 },
};

// The ring course, flown in order after take-off from the home strip.
export const RINGS = [
  { x: 0, y: -820, z: 150 },
  { x: 190, y: -360, z: 188 },
  { x: 430, y: 140, z: 214 },
  { x: 310, y: 640, z: 172 },
  { x: -60, y: 1010, z: 232 },
  { x: -330, y: 1360, z: 196 },
  { x: -150, y: 1740, z: 176 },
  { x: 130, y: 1980, z: 152 },
];
export const RING_RADIUS = 26;

// Flight model tuning (arcade-leaning, but throttle and turn discipline pay).
export const PLANE = {
  maxThrust: 9.5, // m/s^2 at full throttle, sea level
  dragBase: 0.0035,
  dragInduced: 0.055,
  stallSpeed: 17, // m/s
  rotateSpeed: 19,
  maxSpeed: 64,
  pitchRate: 0.85, // rad/s at full stick
  rollRate: 1.9,
  maxRoll: 1.05, // rad of bank the stick can hold
  turnGain: 10.6, // heading rate per radian of bank at cruise
  gravity: 9.81,
  fuelBurn: 0.055, // tank units per second at full throttle
  tankSize: 100,
};

export const SCORE = {
  ring: 250,
  ringTimeBonusMax: 90,
  landingBase: 400,
  smoothLandingBonus: 200,
  fuelBonusPerUnit: 4,
};

// Fixed-step simulation: the same inputs always fly the same sortie.
export const STEP = 1 / 60;
