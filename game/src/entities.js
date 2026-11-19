// The people and the traffic of Sunset Bay. Pedestrians stroll the sidewalks
// and flee from danger; traffic cars keep to their lane, turn at crossings,
// and brake for the car ahead. Everything here is ordinary city life until the
// player gives it a reason not to be.

import { WORLD, PLAYER, TRAFFIC, PALETTE } from './config.js';
import { clamp, dist2, pick, randInt } from './utils.js';
import { collideBuildings, isInWater, randomRoadPoint, randomSidewalkPoint, sameStreetPoint } from './world.js';
import { createCar, driveCar } from './vehicles.js';

/** The player, on foot: position, facing, health, cash and ammo. */
export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    health: PLAYER.health,
    cash: 50,
    ammo: PLAYER.pistolAmmo,
    car: null,
    hurtTimer: 0,
    punchTimer: 0,
    punchAngle: 0,
  };
}

/** Move the player on foot for one step. Returns the distance moved. */
export function movePlayerOnFoot(player, world, input, dt) {
  const mv = input.moveVector();
  const speed = input.held('run') ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let nx = player.x + mv.x * speed * dt;
  let ny = player.y + mv.y * speed * dt;
  if (mv.x !== 0 || mv.y !== 0) player.angle = Math.atan2(mv.y, mv.x);
  const fixed = collideBuildings(world, nx, ny, PLAYER.radius);
  nx = fixed.x;
  ny = fixed.y;
  if (isInWater(nx, ny)) { nx = player.x; ny = player.y; }
  const moved = Math.hypot(nx - player.x, ny - player.y);
  player.x = nx;
  player.y = ny;
  return moved;
}

/** One pedestrian: a walker with a destination, a colour and a mood. */
export function createPed(world, rng) {
  const p = randomSidewalkPoint(world, rng);
  return {
    x: p.x, y: p.y, angle: rng() * Math.PI * 2,
    speed: TRAFFIC.pedSpeed * (0.7 + rng() * 0.6),
    tx: p.x, ty: p.y,
    street: { axis: p.axis, at: p.at, side: p.side },
    color: pick(rng, PALETTE.ped),
    state: 'walk',
    stateT: 0,
    down: 0,
  };
}

/**
 * Pick a new sidewalk destination for a pedestrian. People walk along their
 * own street and only occasionally cross to another one, so they stop
 * jaywalking straight across the road into traffic.
 */
function retargetPed(world, rng, ped) {
  if (rng() < 0.85 && ped.street) {
    const p = sameStreetPoint(world, rng, ped.street);
    ped.tx = p.x;
    ped.ty = p.y;
    return;
  }
  const p = randomSidewalkPoint(world, rng);
  ped.tx = p.x;
  ped.ty = p.y;
  ped.street = { axis: p.axis, at: p.at, side: p.side };
}

/** Update one pedestrian: walk, flee, fall down, get up again. */
export function updatePed(world, rng, ped, danger, dt) {
  if (ped.down > 0) {
    ped.down -= dt;
    return;
  }
  if (ped.state === 'flee') {
    ped.stateT -= dt;
    const dx = ped.x - danger.x;
    const dy = ped.y - danger.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = ped.x + (dx / d) * ped.speed * 2.1 * dt;
    const ny = ped.y + (dy / d) * ped.speed * 2.1 * dt;
    const fixed = collideBuildings(world, nx, ny, 10);
    ped.x = fixed.x;
    ped.y = fixed.y;
    ped.angle = Math.atan2(dy, dx);
    if (ped.stateT <= 0) ped.state = 'walk';
    return;
  }
  const dx = ped.tx - ped.x;
  const dy = ped.ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) { retargetPed(world, rng, ped); return; }
  const nx = ped.x + (dx / d) * ped.speed * dt;
  const ny = ped.y + (dy / d) * ped.speed * dt;
  const fixed = collideBuildings(world, nx, ny, 10);
  ped.x = fixed.x;
  ped.y = fixed.y;
  ped.angle = Math.atan2(dy, dx);
}

/** Scare every pedestrian near a point (a crash, a gunshot, a stolen car). */
export function scarePeds(peds, x, y, radius) {
  for (const ped of peds) {
    if (ped.down > 0) continue;
    if (dist2(ped.x, ped.y, x, y) < radius * radius) {
      ped.state = 'flee';
      ped.stateT = 2.5;
    }
  }
}

/**
 * One traffic car: it drives a leg along one road, then picks the next leg at
 * the crossing. Legs keep it on the right-hand lane of its road.
 */
export function createTrafficCar(world, rng) {
  const p = randomRoadPoint(world, rng);
  const car = createCar(p.x, p.y, 0, 'traffic', pick(rng, PALETTE.car));
  car.leg = pickLeg(world, rng, p.x, p.y);
  car.speed = TRAFFIC.carSpeed * (0.8 + rng() * 0.4);
  return car;
}

/** Choose a leg (axis, road, direction, lane) through a point on a road. */
function pickLeg(world, rng, x, y) {
  const vertical = rng() < 0.5;
  if (vertical) {
    let best = world.vertical[0];
    let bd = Infinity;
    for (const rx of world.vertical) {
      const d = Math.abs(x - rx);
      if (d < bd) { bd = d; best = rx; }
    }
    const dir = rng() < 0.5 ? 1 : -1;
    return { axis: 'v', at: best, dir, lane: dir > 0 ? WORLD.roadWidth / 4 : -WORLD.roadWidth / 4 };
  }
  let best = world.horizontal[0];
  let bd = Infinity;
  for (const ry of world.horizontal) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; best = ry; }
  }
  const dir = rng() < 0.5 ? 1 : -1;
  return { axis: 'h', at: best, dir, lane: dir > 0 ? WORLD.roadWidth / 4 : -WORLD.roadWidth / 4 };
}

/** The point a traffic car's leg aims at, a little ahead of the car. */
function legTarget(car) {
  const look = 260;
  if (car.leg.axis === 'v') {
    return { x: car.leg.at + car.leg.lane, y: car.y + car.leg.dir * look };
  }
  return { x: car.x + car.leg.dir * look, y: car.leg.at + car.leg.lane };
}

/** Update one traffic car: follow its leg, brake for the car ahead, turn. */
export function updateTrafficCar(world, rng, car, cars, dt) {
  if (car.wrecked) return;
  // At the end of a road, pick a new leg at the crossing.
  const end = car.leg.axis === 'v'
    ? (car.leg.dir > 0 ? WORLD.height - 60 : 60)
    : (car.leg.dir > 0 ? WORLD.width - 60 : 60);
  const along = car.leg.axis === 'v' ? car.y : car.x;
  if ((car.leg.dir > 0 && along > end) || (car.leg.dir < 0 && along < end)) {
    car.leg = pickLeg(world, rng, car.x, car.y);
  }
  // Brake when another car is close ahead on the same lane.
  let targetSpeed = TRAFFIC.carSpeed;
  for (const other of cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = car.leg.axis === 'v' ? dy * car.leg.dir : dx * car.leg.dir;
    const side = car.leg.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
    if (ahead > 0 && ahead < 70 && side < 40) { targetSpeed = 0; break; }
  }
  const t = legTarget(car);
  const want = Math.atan2(t.y - car.y, t.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = clamp(diff * 2.2, -1, 1);
  const throttle = car.speed < targetSpeed ? 0.6 : 0;
  driveCar(car, { throttle, steer }, dt);
  // Keep it glued to its lane.
  if (car.leg.axis === 'v') car.x += (car.leg.at + car.leg.lane - car.x) * 0.06;
  else car.y += (car.leg.at + car.leg.lane - car.y) * 0.06;
  car.x = clamp(car.x, 30, WORLD.width - 30);
  car.y = clamp(car.y, 30, WORLD.height - 30);
}

/** Parked cars along the kerb, empty and stealable. */
export function createParkedCar(world, rng) {
  const vertical = rng() < 0.5;
  let x;
  let y;
  let angle;
  if (vertical) {
    const rx = pick(rng, world.vertical);
    const side = rng() < 0.5 ? -1 : 1;
    x = rx + side * (WORLD.roadWidth / 2 + 14);
    y = 120 + rng() * (WORLD.height - 320);
    angle = side > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const ry = pick(rng, world.horizontal);
    const side = rng() < 0.5 ? -1 : 1;
    x = 120 + rng() * (WORLD.width - 240);
    y = ry + side * (WORLD.roadWidth / 2 + 14);
    angle = side > 0 ? 0 : Math.PI;
  }
  return createCar(x, y, angle, 'parked', pick(rng, PALETTE.car));
}

/** Keep the street populated: top up traffic and pedestrians near the player. */
export function maintainPopulation(state, rng) {
  const { world } = state;
  let traffic = 0;
  for (const c of state.cars) if (c.kind === 'traffic') traffic += 1;
  while (traffic < TRAFFIC.cars) {
    const p = randomRoadPoint(world, rng);
    if (dist2(p.x, p.y, state.player.x, state.player.y) < 500 * 500) {
      // Too close to the player: try another spot.
      if (rng() < 0.7) continue;
    }
    state.cars.push(createTrafficCar(world, rng));
    traffic += 1;
  }
  while (state.peds.length < TRAFFIC.peds) {
    state.peds.push(createPed(world, rng));
  }
  // Parked cars: keep about eight on the streets.
  let parked = 0;
  for (const c of state.cars) if (c.kind === 'parked') parked += 1;
  while (parked < 8) {
    state.cars.push(createParkedCar(world, rng));
    parked += 1;
  }
}

/** Push overlapping cars apart (a cheap circle pass, run after movement). */
export function separateCars(cars, audio) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.wrecked && b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      // 36px: two cars passing in adjacent lanes (48px apart) do not touch,
      // but a real overlap in one lane still resolves.
      const min = 36;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 120 && audio) audio.crash();
        // A nudge, not a full stop: a chase should keep moving after a bump.
        a.speed *= 0.9;
        b.speed *= 0.9;
      }
    }
  }
}
