// Small math and random helpers shared by every Sunset Bay module. Nothing here
// touches the network or the DOM: pure functions over numbers, so the game loop
// can call them thousands of times a frame without surprises.

/** Clamp `v` into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Linear interpolation between a and b by t in [0, 1]. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest signed difference between two angles, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Squared distance between two points (avoids a sqrt in hot checks). */
export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** True when two axis-aligned rectangles overlap. */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** True when the point (px, py) lies inside rect r. */
export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/** A tiny deterministic RNG (mulberry32) so a seed always rebuilds the same city. */
export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from a rng. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of arr, picked by a rng. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Fisher-Yates shuffle of a copy of arr, driven by a rng. */
export function shuffled(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
