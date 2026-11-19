// Combat: fists up close, a pistol at range, and the consequences of both.
// Bullets are instant hitscan with a tracer effect; the city notices gunfire.

import { PLAYER, WANTED } from './config.js';
import { dist2 } from './utils.js';
import { addWanted, commitCrime } from './police.js';
import { scarePeds } from './entities.js';
import { damageCar } from './vehicles.js';

/**
 * A punch: a short arc in front of the player. Peds in the arc fall down;
 * hitting one in view of the city raises the heat. Returns true on a hit.
 */
export function punch(state, audio) {
  const player = state.player;
  if (player.punchTimer > 0 || player.car) return false;
  player.punchTimer = 0.35;
  player.punchAngle = player.angle;
  let hit = false;
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    const d = Math.hypot(ped.x - player.x, ped.y - player.y);
    if (d > PLAYER.punchRange + 10) continue;
    const a = Math.atan2(ped.y - player.y, ped.x - player.x);
    let diff = a - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < PLAYER.punchArc) {
      ped.down = 3;
      ped.state = 'walk';
      hit = true;
    }
  }
  if (hit) {
    if (audio) audio.punch();
    commitCrime(state, player.x, player.y, WANTED.hitPed);
    scarePeds(state.peds, player.x, player.y, 220);
  }
  return hit;
}

/**
 * A pistol shot in the aim direction (mouse aim on foot). Hits the nearest
 * ped, police car or traffic car along the ray within range. Returns the hit
 * point, or null when the shot misses everything.
 */
export function shoot(state, aimAngle, audio) {
  const player = state.player;
  if (player.car || player.ammo <= 0) return null;
  player.ammo -= 1;
  if (audio) audio.shoot();
  const ox = player.x;
  const oy = player.y;
  const dx = Math.cos(aimAngle);
  const dy = Math.sin(aimAngle);
  let best = null;
  let bestT = PLAYER.pistolRange;
  const ex = ox + dx * PLAYER.pistolRange;
  const ey = oy + dy * PLAYER.pistolRange;
  function consider(x, y, radius, target) {
    const vx = x - ox;
    const vy = y - oy;
    const t = vx * dx + vy * dy;
    if (t < 0 || t > bestT) return;
    const px = ox + dx * t;
    const py = oy + dy * t;
    const d2 = (x - px) * (x - px) + (y - py) * (y - py);
    if (d2 < radius * radius) {
      bestT = t;
      best = { x, y, target };
    }
  }
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    consider(ped.x, ped.y, 16, { type: 'ped', ref: ped });
  }
  for (const car of state.cars) {
    if (car.driver === 'player') continue;
    consider(car.x, car.y, 34, { type: 'car', ref: car });
  }
  const hitX = best ? best.x : ex;
  const hitY = best ? best.y : ey;
  state.tracers.push({ x1: ox, y1: oy, x2: hitX, y2: hitY, life: 0.09 });
  if (best) {
    if (best.target.type === 'ped') {
      best.target.ref.down = 999;
      best.target.ref.state = 'walk';
    } else {
      damageCar(best.target.ref, PLAYER.pistolDamage);
      if (best.target.ref.kind === 'police') addWanted(state, WANTED.killCop);
    }
    commitCrime(state, player.x, player.y, WANTED.shoot);
    scarePeds(state.peds, player.x, player.y, 300);
  } else {
    commitCrime(state, player.x, player.y, WANTED.shoot);
  }
  return { x: hitX, y: hitY };
}

/** The player takes damage; returns true when it kills them. */
export function hurtPlayer(state, amount) {
  const player = state.player;
  if (player.hurtTimer > 0) return false;
  player.health -= amount;
  player.hurtTimer = 0.6;
  if (player.health <= 0) {
    player.health = 0;
    return true;
  }
  return false;
}

/** Slow health recovery when the player has been out of trouble a while. */
export function regenPlayer(player, dt) {
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
  else if (player.health > 0 && player.health < PLAYER.health) {
    player.health = Math.min(PLAYER.health, player.health + 1.2 * dt);
  }
}
