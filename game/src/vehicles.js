// Cars: one physics model for every car, whether the player drives it or the
// AI does. Steering is front-wheel, grip pulls velocity toward the heading,
// and speed caps keep the chase readable. Stealing is an interaction, not a
// physics event: it swaps who drives and who stands on the sidewalk.

import { CAR, PALETTE } from './config.js';
import { angleDiff, clamp, pick } from './utils.js';

let nextCarId = 1;

/** Make a car. `kind` is 'player' | 'traffic' | 'parked' | 'police'. */
export function createCar(x, y, angle, kind, color) {
  const car = {
    id: nextCarId,
    x, y, angle,
    speed: 0,
    steer: 0,
    color: color ?? pick(Math.random, PALETTE.car),
    kind,
    driver: kind === 'traffic' ? 'ai' : 'none',
    health: CAR.health,
    wrecked: false,
    headlights: false,
    skid: 0,
    siren: kind === 'police',
    // Police interceptors are tuned hotter than a street car, so they can
    // close on a player driving flat out.
    accel: kind === 'police' ? 520 : CAR.accel,
    maxSpeed: kind === 'police' ? 500 : CAR.maxSpeed,
  };
  return car;
}

/**
 * Drive one car for dt seconds. `drive` is { throttle -1..1, steer -1..1 }.
 * Returns nothing; the car's speed, angle and position are updated in place.
 */
export function driveCar(car, drive, dt) {
  if (car.wrecked) return;
  const accel = drive.throttle > 0 ? (car.accel ?? CAR.accel) : CAR.brake;
  car.speed += drive.throttle * accel * dt;
  // Rolling resistance and a hard cap, forward and back.
  car.speed -= car.speed * 0.55 * dt;
  car.speed = clamp(car.speed, -CAR.maxReverse, car.maxSpeed ?? CAR.maxSpeed);
  if (Math.abs(car.speed) < 2 && drive.throttle === 0) car.speed = 0;
  // Steering only bites while moving, and more at low speed.
  const grip = clamp(Math.abs(car.speed) / 120, 0.25, 1);
  car.angle += drive.steer * CAR.turnRate * grip * dt * Math.sign(car.speed || 1);
  car.angle = ((car.angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Skid marks when turning hard at speed.
  car.skid = Math.abs(drive.steer) > 0.7 && Math.abs(car.speed) > 200 ? 1 : 0;
}

/** Steer a car toward a target point (used by police and traffic AI). */
export function steerToward(car, tx, ty, throttle) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(car.angle, want);
  return { throttle, steer: clamp(diff * 1.6, -1, 1) };
}

/**
 * The player steps into a car: the car becomes the player's, the player is no
 * longer on foot, and the car's previous driver (if any) is left standing.
 * Returns the displaced driver position, or null when the car was empty.
 */
export function enterCar(player, car) {
  const displaced = car.driver === 'ai' ? { x: car.x - Math.cos(car.angle) * 40, y: car.y - Math.sin(car.angle) * 40 } : null;
  car.driver = 'player';
  car.kind = 'player';
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  return displaced;
}

/** The player steps out of their car onto the road beside it. */
export function exitCar(player) {
  const car = player.car;
  if (!car) return;
  car.driver = 'none';
  car.kind = 'parked';
  const side = Math.cos(car.angle + Math.PI / 2);
  const sideY = Math.sin(car.angle + Math.PI / 2);
  player.x = car.x + side * 34;
  player.y = car.y + sideY * 34;
  player.angle = car.angle;
  player.car = null;
}

/** Damage a car; at zero health it is a wreck that no longer drives. */
export function damageCar(car, amount) {
  if (car.wrecked) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
  }
}

/** A wrecked car smokes; a healthy one does not. */
export function isWrecked(car) {
  return car.wrecked;
}
