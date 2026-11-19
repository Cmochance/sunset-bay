// Sunset Bay itself: one seeded city, built the same way from the same seed.
// Roads form a grid, blocks hold buildings, parks and lots, and the south edge
// is sand and water. Everything the simulation needs to ask the city lives
// here: what is road, what blocks movement, and where the named places are.

import { WORLD, PALETTE } from './config.js';
import { createRng, pick, randInt } from './utils.js';

const MARGIN = 34;

/** Named places the missions send the player to. */
export const PLACES = {
  safehouse: { name: "Rex's Safehouse", x: 300, y: 300 },
  paintShop: { name: 'Sunset Paint & Body', x: 1000, y: 640 },
  marina: { name: 'Marina Docks', x: 2600, y: 2050 },
  hotel: { name: 'Palms Hotel', x: 1800, y: 1040 },
  park: { name: 'Sunset Park', x: 620, y: 1420 },
  tower: { name: 'Bay Tower', x: 2200, y: 640 },
  docks: { name: 'Harbor Docks', x: 2850, y: 2250 },
  hospital: { name: 'St. Marisol Hospital', x: 1420, y: 1840 },
  casino: { name: 'Golden Gull Casino', x: 1020, y: 1840 },
  beachBar: { name: 'Tide Bar', x: 2400, y: 2260 },
};

/**
 * Build the city from a seed. Roads run every WORLD.roadSpacing pixels, offset
 * by half a spacing so the edges are blocks, not roads.
 */
export function createWorld(seed) {
  const rng = createRng(seed);
  const vertical = [];
  const horizontal = [];
  for (let x = WORLD.roadSpacing / 2; x < WORLD.width; x += WORLD.roadSpacing) vertical.push(x);
  for (let y = WORLD.roadSpacing / 2; y < WORLD.height - 160; y += WORLD.roadSpacing) horizontal.push(y);

  const buildings = [];
  const palms = [];
  const parks = [];
  const lots = [];

  // Blocks are the cells between neighbouring roads. Each block gets either a
  // row of buildings, a park, or a parking lot; the beach strip stays open.
  for (let ci = 0; ci < vertical.length - 1; ci += 1) {
    for (let ri = 0; ri < horizontal.length - 1; ri += 1) {
      const x0 = vertical[ci] + WORLD.roadWidth / 2 + WORLD.sidewalk + 8;
      const x1 = vertical[ci + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk - 8;
      const y0 = horizontal[ri] + WORLD.roadWidth / 2 + WORLD.sidewalk + 8;
      const y1 = horizontal[ri + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk - 8;
      if (y0 > 2150) continue; // beachfront stays open sand
      const roll = rng();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = randInt(rng, 3, 6);
        for (let i = 0; i < n; i += 1) {
          palms.push({ x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0), r: 9 + rng() * 5 });
        }
        continue;
      }
      if (roll < 0.26) {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // A row of one to three buildings along the block.
      const count = randInt(rng, 1, 3);
      const bw = (x1 - x0 - (count - 1) * 18) / count;
      for (let b = 0; b < count; b += 1) {
        const bx = x0 + b * (bw + 18);
        const bh = (y1 - y0) * (0.45 + rng() * 0.5);
        const by = y0 + rng() * ((y1 - y0) - bh);
        const ci2 = Math.floor(rng() * PALETTE.building.length);
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: PALETTE.building[ci2],
          roof: PALETTE.buildingRoof[ci2],
          shade: 10 + rng() * 14,
        });
      }
    }
  }

  // Palms along the beachfront boulevard and a few on sidewalks.
  for (let x = 260; x < WORLD.width - 100; x += 260) {
    palms.push({ x, y: 2180 + rng() * 40, r: 10 + rng() * 4 });
  }

  return { seed, vertical, horizontal, buildings, palms, parks, lots };
}

/** True when the point is on asphalt (inside a road's width). */
export function isOnRoad(world, x, y) {
  const half = WORLD.roadWidth / 2;
  for (const rx of world.vertical) if (Math.abs(x - rx) < half) return true;
  for (const ry of world.horizontal) if (Math.abs(y - ry) < half) return true;
  return false;
}

/** True when the point is on a sidewalk band beside a road. */
export function isOnSidewalk(world, x, y) {
  const half = WORLD.roadWidth / 2;
  const edge = half + WORLD.sidewalk;
  for (const rx of world.vertical) {
    if (Math.abs(x - rx) < edge && Math.abs(x - rx) >= half) return true;
  }
  for (const ry of world.horizontal) {
    if (Math.abs(y - ry) < edge && Math.abs(y - ry) >= half) return true;
  }
  return false;
}

/** True when the point is on the beach sand strip. */
export function isOnSand(x, y) {
  return y > 2200 && y < WORLD.height;
}

/** True when the point is in the water (south edge). */
export function isInWater(x, y) {
  return y > WORLD.height - 80;
}

/** The building whose rectangle contains the point, or null. */
export function buildingAt(world, x, y) {
  for (const b of world.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/**
 * Push a circle (x, y, r) out of every building it overlaps, so a walker or a
 * car slides along walls instead of passing through them. Returns the
 * corrected position.
 */
export function collideBuildings(world, x, y, r) {
  let px = x;
  let py = y;
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(px, b.x + b.w));
    const cy = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - cx;
    const dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 === 0) { py = b.y - r; continue; }
      const d = Math.sqrt(d2);
      px = cx + (dx / d) * r;
      py = cy + (dy / d) * r;
    }
  }
  px = Math.max(r, Math.min(WORLD.width - r, px));
  py = Math.max(r, Math.min(WORLD.height - r, py));
  return { x: px, y: py };
}

/** A random point on a road (centre of a random road, random along it). */
export function randomRoadPoint(world, rng) {
  if (rng() < 0.5) {
    const rx = pick(rng, world.vertical);
    return { x: rx, y: 60 + rng() * (WORLD.height - 220) };
  }
  const ry = pick(rng, world.horizontal);
  return { x: 60 + rng() * (WORLD.width - 120), y: ry };
}

/** A random point on a sidewalk beside a random road, with its street. */
export function randomSidewalkPoint(world, rng) {
  if (rng() < 0.5) {
    const rx = pick(rng, world.vertical);
    const side = rng() < 0.5 ? -1 : 1;
    return { x: rx + side * (WORLD.roadWidth / 2 + WORLD.sidewalk / 2), y: 60 + rng() * (WORLD.height - 220), axis: 'v', at: rx, side };
  }
  const ry = pick(rng, world.horizontal);
  const side = rng() < 0.5 ? -1 : 1;
  return { x: 60 + rng() * (WORLD.width - 120), y: ry + side * (WORLD.roadWidth / 2 + WORLD.sidewalk / 2), axis: 'h', at: ry, side };
}

/** A random point on the same street as `street` (same axis, road, side). */
export function sameStreetPoint(world, rng, street) {
  const off = WORLD.roadWidth / 2 + WORLD.sidewalk / 2;
  if (street.axis === 'v') {
    return { x: street.at + street.side * off, y: 60 + rng() * (WORLD.height - 220) };
  }
  return { x: 60 + rng() * (WORLD.width - 120), y: street.at + street.side * off };
}

/** The nearest road centreline to a point, with its orientation. */
export function nearestRoad(world, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of world.vertical) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { axis: 'v', at: rx, dist: d }; }
  }
  for (const ry of world.horizontal) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { axis: 'h', at: ry, dist: d }; }
  }
  return best;
}
