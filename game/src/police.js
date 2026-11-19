// The wanted system: stars go up when the city sees a crime, police cars come
// looking, and the heat only fades when nobody can see you. A paint shop
// clears the record for cash, the way it always has in Sunset Bay.

import { POLICE, WANTED, WORLD, PALETTE } from './config.js';
import { clamp, dist2, pick } from './utils.js';
import { randomRoadPoint, collideBuildings } from './world.js';
import { createCar, driveCar, steerToward, damageCar } from './vehicles.js';

/** Add stars, capped at the maximum. Returns the new level. */
export function addWanted(state, stars) {
  state.wanted = clamp(state.wanted + stars, 0, WANTED.maxStars);
  state.wantedTimer = 0;
  return state.wanted;
}

/** True when anyone nearby could have seen the crime. */
export function witnessed(state, x, y) {
  for (const p of state.police) {
    if (dist2(p.x, p.y, x, y) < 500 * 500) return true;
  }
  for (const ped of state.peds) {
    if (ped.down <= 0 && dist2(ped.x, ped.y, x, y) < 250 * 250) return true;
  }
  return false;
}

/** A crime the player commits: raise the heat if the city saw it. */
export function commitCrime(state, x, y, stars) {
  if (witnessed(state, x, y)) addWanted(state, stars);
}

/** Spawn a police car on a road at least spawnDistance from the player. */
function spawnPolice(state, rng) {
  let p;
  let tries = 0;
  do {
    p = randomRoadPoint(state.world, rng);
    tries += 1;
  } while (tries < 12 && dist2(p.x, p.y, state.player.x, state.player.y) < POLICE.spawnDistance * POLICE.spawnDistance);
  const car = createCar(p.x, p.y, rng() * Math.PI * 2, 'police', PALETTE.police);
  car.driver = 'ai';
  car.siren = true;
  return car;
}

/** Keep the right number of police on the street for the wanted level. */
export function maintainPolice(state, rng, dt) {
  const want = Math.min(state.wanted, POLICE.maxCars);
  while (state.police.length < want) {
    const car = spawnPolice(state, rng);
    state.police.push(car);
    state.cars.push(car);
  }
  while (state.police.length > want) {
    const car = state.police.pop();
    const idx = state.cars.indexOf(car);
    if (idx >= 0) state.cars.splice(idx, 1);
  }
}

/**
 * Update every police car: chase the player, ram their car, and bust them if
 * they are caught standing still on foot. Returns 'busted' when the bust
 * timer completes, otherwise null.
 */
export function updatePolice(state, dt) {
  const player = state.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  let nearest = Infinity;
  for (let i = 0; i < state.police.length; i += 1) {
    const car = state.police[i];
    if (car.wrecked) continue;
    const d = Math.hypot(px - car.x, py - car.y);
    if (d < nearest) nearest = d;
    // Chase the player's predicted position, a little ahead of where they
    // are. The cars queue up in a convoy behind the player — each one aims
    // a little further back along the chase line — instead of stacking every
    // car on the same point or drifting into the oncoming lane.
    const lead = player.car ? 0.5 : 0;
    const tx0 = px + (player.car ? Math.cos(player.car.angle) * player.car.speed * lead : 0);
    const ty0 = py + (player.car ? Math.sin(player.car.angle) * player.car.speed * lead : 0);
    const dir = Math.atan2(ty0 - car.y, tx0 - car.x);
    const back = i * 70;
    const lateral = (i % 2 === 0 ? 1 : -1) * 15;
    let tx = tx0 - Math.cos(dir) * back + Math.cos(dir + Math.PI / 2) * lateral;
    let ty = ty0 - Math.sin(dir) * back + Math.sin(dir + Math.PI / 2) * lateral;
    // Overtake: if another car is right ahead, swing around it instead of
    // sitting on its bumper while the player gets away.
    for (const other of state.cars) {
      if (other === car || other.wrecked) continue;
      const ox = other.x - car.x;
      const oy = other.y - car.y;
      const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
      const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 110 && side < 40) {
        const swing = (i % 2 === 0 ? 1 : -1) * 60;
        tx += Math.cos(dir + Math.PI / 2) * swing;
        ty += Math.sin(dir + Math.PI / 2) * swing;
        break;
      }
    }
    const drive = steerToward(car, tx, ty, 1);
    driveCar(car, drive, dt);
    const fixed = collideBuildings(state.world, car.x, car.y, 26);
    if (Math.abs(fixed.x - car.x) + Math.abs(fixed.y - car.y) > 1) car.speed *= 0.5;
    car.x = fixed.x;
    car.y = fixed.y;
    car.x = clamp(car.x, 30, WORLD.width - 30);
    car.y = clamp(car.y, 30, WORLD.height - 30);
    // Ramming the player's car damages it and shoves it forward — a ram
    // speeds the chase up, it does not grind it to a halt.
    if (player.car && d < 52) {
      damageCar(player.car, POLICE.ramDamage * dt * 2);
      player.car.speed = Math.max(player.car.speed, car.speed * 0.85);
      car.speed *= 0.85;
      if (player.car.wrecked) {
        player.car.driver = 'none';
        player.car.kind = 'parked';
        player.car = null;
      }
    }
  }
  // Bust: a police car is on top of the player while they are on foot and slow.
  if (!player.car && state.wanted > 0 && nearest < 46) {
    state.bustTimer += dt;
    if (state.bustTimer >= POLICE.bustSeconds) return 'busted';
  } else {
    state.bustTimer = 0;
  }
  // The heat fades when no police car can see the player.
  if (state.wanted > 0) {
    if (nearest > 650) {
      state.wantedTimer += dt;
      if (state.wantedTimer >= WANTED.decaySeconds) {
        state.wanted -= 1;
        state.wantedTimer = 0;
      }
    } else {
      state.wantedTimer = 0;
    }
  }
  return null;
}

/** The paint shop: drive in with cash and the heat is gone. */
export function tryPaintShop(state) {
  const shop = { x: 1000, y: 640 };
  const px = state.player.car ? state.player.car.x : state.player.x;
  const py = state.player.car ? state.player.car.y : state.player.y;
  if (state.wanted > 0 && state.player.car && dist2(px, py, shop.x, shop.y) < 90 * 90 && state.player.cash >= 50) {
    state.player.cash -= 50;
    state.wanted = 0;
    state.wantedTimer = 0;
    if (state.player.car) state.player.car.color = pick(Math.random, PALETTE.car);
    return true;
  }
  return false;
}

/** Clear the wanted level (used after a bust or a hospital visit). */
export function clearWanted(state) {
  state.wanted = 0;
  state.wantedTimer = 0;
  state.bustTimer = 0;
}
