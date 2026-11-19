// Sunset Bay tuning: every number the game balances on lives here, so a tweak
// never means hunting through the simulation. The palette is one warm late
// afternoon: orange sun, teal water, dusty roads, purple shade.

export const WORLD = {
  width: 3200,
  height: 2400,
  /** Roads are spaced this far apart, centre to centre. */
  roadSpacing: 400,
  /** Asphalt width of one road. */
  roadWidth: 96,
  /** Sidewalk band on each side of a road. */
  sidewalk: 26,
};

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6d9c4c',
  sand: '#e8c98a',
  water: '#2e7f9e',
  waterDeep: '#1f5f7d',
  road: '#3c3a44',
  roadLine: '#e8d27a',
  sidewalk: '#9a938a',
  building: ['#c96f4a', '#b45a6e', '#5a7ba6', '#7a6a9e', '#c9a24a', '#4a8a7a'],
  buildingRoof: ['#a85438', '#93455c', '#48648c', '#655a85', '#a8853a', '#3a6e60'],
  car: ['#d94f3d', '#3d7bd9', '#e8b73d', '#7ad94f', '#c9c9c9', '#8a4fd9', '#3dd9c9'],
  police: '#2b3a55',
  player: '#e8e4d8',
  ped: ['#e8b04a', '#7a4a9e', '#4a9e6e', '#d97a4a', '#5a7ad9'],
  palm: '#3d7a4a',
  palmTrunk: '#8a6a4a',
  hudBg: 'rgba(12, 10, 18, 0.72)',
  hudText: '#fff3d6',
  accent: '#ffb13d',
  danger: '#ff4d4d',
  good: '#7dff8a',
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 185,
  runSpeed: 265,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchArc: 1.1,
  pistolDamage: 34,
  pistolRange: 420,
  pistolAmmo: 24,
  maxAmmo: 48,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 420,
  brake: 700,
  maxSpeed: 430,
  maxReverse: 140,
  turnRate: 2.6,
  grip: 3.2,
  health: 100,
};

export const POLICE = {
  maxCars: 6,
  accel: 520,
  maxSpeed: 500,
  ramDamage: 8,
  bustSeconds: 2.2,
  spawnDistance: 700,
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 14,
  steal: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 2,
};

export const TRAFFIC = {
  cars: 14,
  peds: 26,
  carSpeed: 95,
  pedSpeed: 42,
};

export const SAVE_KEY = 'sunset-bay-save-v1';
export const STEP = 1 / 60;
export const MISSION_REWARD = [150, 250, 300, 400, 800];
