// Screenshot staging: deterministic, photogenic scenes for the bounty cover
// and the extra shots. A shot name in the URL (?shot=chase) skips the title
// screen, places the player, the police and the traffic, then runs a short
// autopilot so the frame is alive — and only then sets window.__shotReady,
// which the screenshot script waits for.

import { PALETTE } from './config.js';
import { createCar, steerToward, driveCar } from './vehicles.js';
import { createPed, createTrafficCar } from './entities.js';
import { nearestRoad, collideBuildings } from './world.js';

const SHOT_NAMES = ['chase', 'drive', 'foot', 'heist'];

/** The shot name from the URL, or null when the game runs normally. */
export function shotFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  return SHOT_NAMES.includes(name) ? name : null;
}

/**
 * Put traffic and pedestrians near a point. Traffic goes on the oncoming lane
 * (the player drives east on y + 24, so traffic heads west on y - 24) so it
 * streams past instead of blocking the player's lane; pedestrians stay on the
 * sidewalk band, never on the asphalt.
 */
function streetLife(state, rng, x, y, carCount, pedCount) {
  for (let i = 0; i < carCount; i += 1) {
    const car = createTrafficCar(state.world, rng);
    car.x = x + 320 + i * 340 + rng() * 60;
    car.y = y - 24;
    car.angle = Math.PI;
    // Lock this car to the oncoming lane heading west, so it streams past
    // and never turns across the player's path at a crossing.
    car.leg = { axis: 'h', at: y, dir: -1, lane: -24 };
    state.cars.push(car);
  }
  for (let i = 0; i < pedCount; i += 1) {
    const ped = createPed(state.world, rng);
    ped.x = x + (rng() - 0.5) * 700;
    ped.y = y + (rng() < 0.5 ? -61 : 61) + (rng() - 0.5) * 16;
    // The ped was created on a random street: re-root it to this street, or
    // it will walk back across the map — and across the player's road.
    ped.street = { axis: 'h', at: y, side: ped.y < y ? -1 : 1 };
    ped.tx = ped.x + (rng() - 0.5) * 400;
    ped.ty = ped.y;
    state.peds.push(ped);
  }
}

/** Put police cars behind the player's car, already in pursuit. */
function policeBehind(state, rng, count, gap) {
  const pc = state.player.car;
  for (let i = 0; i < count; i += 1) {
    const car = createCar(pc.x - gap * (i + 1) - rng() * 40, pc.y + (i % 2 === 0 ? -48 : 48), pc.angle, 'police', PALETTE.police);
    car.driver = 'ai';
    car.siren = true;
    car.speed = pc.speed;
    state.police.push(car);
    state.cars.push(car);
  }
}

/** Place the player in a car on a road, heading east, at a given speed. */
function playerDriving(state, x, y, speed, color) {
  const car = createCar(x, y, 0, 'player', color);
  car.driver = 'player';
  car.speed = speed;
  state.cars.push(car);
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.camera.x = x;
  state.camera.y = y;
}

/** Build one staged scene. Returns the autopilot duration in seconds. */
export function setupShot(state, name, rng) {
  state.screen = 'playing';
  state.messages = [];
  if (name === 'chase') {
    // Heat Wave, step 2: the player already has 3 stars and must lose them —
    // a step that cannot complete in a 2.6-second shot, so the objective and
    // the stars stay on screen while the chase runs.
    state.mission.index = 2;
    state.mission.step = 1;
    playerDriving(state, 700, 1024, 320, '#d94f3d');
    policeBehind(state, rng, 3, 110);
    streetLife(state, rng, 800, 1000, 2, 8);
    state.wanted = 3;
    state.messages.push({ text: 'The Bay PD is on your tail — lose them!', t: 30 });
  } else if (name === 'drive') {
    // Sunset Delivery, step 1: the package is far away at the Marina Docks,
    // so the drive stays in progress and the waypoint points down the road.
    state.mission.index = 1;
    state.mission.step = 0;
    playerDriving(state, 800, 624, 200, '#3d7bd9');
    streetLife(state, rng, 900, 600, 3, 10);
    state.wanted = 0;
  } else if (name === 'foot') {
    state.mission.index = 0;
    state.mission.step = 0;
    state.player.x = 660;
    state.player.y = 1400;
    state.player.angle = 0.4;
    const car = createCar(700, 1424, 0, 'parked', '#e8b73d');
    state.cars.push(car);
    streetLife(state, rng, 600, 1400, 2, 10);
    state.wanted = 0;
    state.messages.push({ text: 'Steal a car — walk up to one and press E', t: 30 });
  } else if (name === 'heist') {
    state.mission.index = 4;
    state.mission.step = 1;
    playerDriving(state, 1100, 1824, 300, '#e8b73d');
    policeBehind(state, rng, 4, 110);
    streetLife(state, rng, 1200, 1800, 2, 6);
    state.wanted = 4;
    state.messages.push({ text: 'The take is yours — and the whole Bay PD knows it!', t: 30 });
    state.messages.push({ text: 'Escape to the Harbor Docks — the boat is waiting', t: 30 });
  }
  state.shot = { name, t: 0, duration: name === 'foot' ? 0.6 : name === 'drive' ? 2.0 : 2.6, done: false };
  // The autopilot stays on the road the player is already driving on, so it
  // never swerves onto a crossing at an intersection.
  if (state.player.car) {
    state.shot.road = { axis: 'h', at: state.player.car.y - 24, lane: 24 };
  }
  return state.shot.duration;
}

/**
 * Drive the staged scene for a few seconds: the player's car follows its
 * road on autopilot so traffic, police and the camera settle into a real
 * chase frame. Sets window.__shotReady when the scene is ready to capture.
 */
export function updateShot(state, dt) {
  const shot = state.shot;
  if (!shot || shot.done) return;
  shot.t += dt;
  const car = state.player.car;
  if (car && !car.wrecked) {
    // Follow the road locked at setup: aim 400px ahead along its centreline,
    // on the right-hand lane for the direction of travel.
    const road = state.shot.road ?? nearestRoad(state.world, car.x, car.y);
    let tx;
    let ty;
    if (road.axis === 'h') {
      const lane = Math.cos(car.angle) >= 0 ? 24 : -24;
      tx = car.x + Math.cos(car.angle) * 400;
      ty = road.at + lane;
    } else {
      const lane = Math.sin(car.angle) >= 0 ? 24 : -24;
      tx = road.at + lane;
      ty = car.y + Math.sin(car.angle) * 400;
    }
    const drive = steerToward(car, tx, ty, 1);
    driveCar(car, drive, dt);
    const fixed = collideBuildings(state.world, car.x, car.y, 26);
    car.x = fixed.x;
    car.y = fixed.y;
  }
  if (shot.t >= shot.duration) {
    shot.done = true;
    window.__shotReady = true;
  }
}
