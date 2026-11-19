// Drawing Sunset Bay: ground, roads, buildings, people, cars, particles and
// the mission marker, all in warm late-afternoon light. The camera follows
// the player and pulls back a little at speed; anything off screen is never
// drawn, so the frame stays cheap even with a full city around.

import { WORLD, PALETTE, CAR } from './config.js';
import { PLACES } from './world.js';
import { currentTarget } from './missions.js';

/** Rounded-rect path helper (falls back to a plain rect when unavailable). */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** Deterministic shade of a building from its position (stable windows). */
function hash2(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function drawGround(ctx, state, view) {
  const { world } = state;
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(view.x0, view.y0, view.w, view.h);
  // Parks: darker grass.
  ctx.fillStyle = PALETTE.grassDark;
  for (const p of world.parks) {
    if (p.x > view.x1 || p.x + p.w < view.x0 || p.y > view.y1 || p.y + p.h < view.y0) continue;
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // Parking lots: grey slabs.
  ctx.fillStyle = '#7a766e';
  for (const lot of world.lots) {
    if (lot.x > view.x1 || lot.x + lot.w < view.x0 || lot.y > view.y1 || lot.y + lot.h < view.y0) continue;
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
  }
  // Beach sand and water along the south edge.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(view.x0, 0), 2200, Math.min(view.x1, WORLD.width) - Math.max(view.x0, 0), WORLD.height - 2200);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(Math.max(view.x0, 0), WORLD.height - 80, Math.min(view.x1, WORLD.width) - Math.max(view.x0, 0), 80);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let x = Math.floor(view.x0 / 90) * 90; x < view.x1; x += 90) {
    const wave = Math.sin(state.time * 1.2 + x * 0.01) * 4;
    ctx.fillRect(x, WORLD.height - 78 + wave, 46, 3);
    ctx.fillRect(x + 20, WORLD.height - 52 - wave, 40, 3);
  }
}

function drawRoads(ctx, state, view) {
  const { world } = state;
  const half = WORLD.roadWidth / 2;
  const edge = half + WORLD.sidewalk;
  // Sidewalks first (a pale band either side of every road).
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of world.vertical) {
    ctx.fillRect(rx - edge, Math.max(view.y0, 0), edge * 2, Math.min(view.y1, WORLD.height) - Math.max(view.y0, 0));
  }
  for (const ry of world.horizontal) {
    ctx.fillRect(Math.max(view.x0, 0), ry - edge, Math.min(view.x1, WORLD.width) - Math.max(view.x0, 0), edge * 2);
  }
  // Asphalt.
  ctx.fillStyle = PALETTE.road;
  for (const rx of world.vertical) {
    ctx.fillRect(rx - half, Math.max(view.y0, 0), half * 2, Math.min(view.y1, WORLD.height) - Math.max(view.y0, 0));
  }
  for (const ry of world.horizontal) {
    ctx.fillRect(Math.max(view.x0, 0), ry - half, Math.min(view.x1, WORLD.width) - Math.max(view.x0, 0), half * 2);
  }
  // Centre dashes, warm yellow in the low sun.
  ctx.fillStyle = PALETTE.roadLine;
  const dash = 26;
  const gap = 30;
  for (const rx of world.vertical) {
    if (rx < view.x0 || rx > view.x1) continue;
    for (let y = Math.floor(view.y0 / (dash + gap)) * (dash + gap); y < view.y1; y += dash + gap) {
      ctx.fillRect(rx - 2, y, 4, dash);
    }
  }
  for (const ry of world.horizontal) {
    if (ry < view.y0 || ry > view.y1) continue;
    for (let x = Math.floor(view.x0 / (dash + gap)) * (dash + gap); x < view.x1; x += dash + gap) {
      ctx.fillRect(x, ry - 2, dash, 4);
    }
  }
}

function drawBuildings(ctx, state, view) {
  for (const b of state.world.buildings) {
    if (b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 || b.y + b.h < view.y0) continue;
    // Long low-sun shadow to the east.
    ctx.fillStyle = 'rgba(40, 20, 40, 0.28)';
    ctx.fillRect(b.x + b.shade, b.y + b.shade * 0.5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Windows in a stable pattern per building.
    ctx.fillStyle = 'rgba(255, 240, 200, 0.75)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (hash2(b.x + c * 31, b.y + r * 37) < 0.55) {
          ctx.fillRect(b.x + 12 + c * 34, b.y + 12 + r * 34, 14, 10);
        }
      }
    }
  }
}

function drawPalms(ctx, state, view) {
  for (const p of state.world.palms) {
    if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
    ctx.fillStyle = 'rgba(40, 20, 40, 0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x + 6, p.y + 5, p.r + 2, (p.r + 2) * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.palmTrunk;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.fillStyle = PALETTE.palm;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(p.x + Math.cos(a) * p.r * 0.7, p.y + Math.sin(a) * p.r * 0.7, p.r * 0.75, p.r * 0.32, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCar(ctx, car, state) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(20, 10, 20, 0.3)';
  rr(ctx, -CAR.length / 2 + 4, -CAR.width / 2 + 5, CAR.length, CAR.width, 9);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.wrecked ? '#2e2a30' : car.color;
  rr(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 9);
  ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(-6, -CAR.width / 2, 12, CAR.width);
  }
  // Windshield and rear window.
  ctx.fillStyle = 'rgba(180, 220, 235, 0.85)';
  ctx.fillRect(CAR.length / 2 - 16, -CAR.width / 2 + 5, 8, CAR.width - 10);
  ctx.fillRect(-CAR.length / 2 + 8, -CAR.width / 2 + 5, 7, CAR.width - 10);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(CAR.length / 2 - 2, -CAR.width / 2 + 7, 3, 0, Math.PI * 2);
  ctx.arc(CAR.length / 2 - 2, CAR.width / 2 - 7, 3, 0, Math.PI * 2);
  ctx.fill();
  // Police light bar, flashing red and blue.
  if (car.kind === 'police' && !car.wrecked) {
    const on = Math.floor(state.time * 4) % 2 === 0;
    ctx.fillStyle = on ? '#ff3b30' : '#3b82ff';
    ctx.fillRect(-4, -CAR.width / 2 + 3, 8, CAR.width / 2 - 3);
    ctx.fillStyle = on ? '#3b82ff' : '#ff3b30';
    ctx.fillRect(-4, 0, 8, CAR.width / 2 - 3);
  }
  ctx.restore();
}

function drawPed(ctx, ped, state) {
  if (ped.down > 0) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = 'rgba(20, 10, 20, 0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(20, 10, 20, 0.3)';
  ctx.beginPath();
  ctx.ellipse(ped.x + 2, ped.y + 3, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(ped.x, ped.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ped.x, ped.y);
  ctx.lineTo(ped.x + Math.cos(ped.angle) * 12, ped.y + Math.sin(ped.angle) * 12);
  ctx.stroke();
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.car) return; // drawn with the car
  const bob = Math.sin(state.time * 10) * 1.5;
  ctx.fillStyle = 'rgba(20, 10, 20, 0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x + 2, p.y + 4, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.3, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c96f4a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.3, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffb13d';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5 + bob * 0.3, 5, 0, Math.PI * 2);
  ctx.fill();
  if (p.punchTimer > 0) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 26, p.punchAngle - 0.9, p.punchAngle + 0.9);
    ctx.stroke();
  }
}

function drawMarker(ctx, state, view) {
  const target = currentTarget(state.mission);
  if (!target) return;
  const pulse = 1 + Math.sin(state.time * 3) * 0.15;
  // A beam of light over the destination.
  ctx.fillStyle = 'rgba(255, 177, 61, 0.12)';
  ctx.fillRect(target.x - 30, target.y - 260, 60, 260);
  ctx.strokeStyle = PALETTE.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.accent;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
  ctx.fill();
  // Label.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(12, 10, 18, 0.8)';
  const w = ctx.measureText(target.name).width + 16;
  rr(ctx, target.x - w / 2, target.y - 58, w, 24, 6);
  ctx.fill();
  ctx.fillStyle = '#fff3d6';
  ctx.fillText(target.name, target.x, target.y - 41);
  // Off-screen arrow at the screen edge.
  const sx = (target.x - state.camera.x) * state.camera.zoom + view.cw / 2;
  const sy = (target.y - state.camera.y) * state.camera.zoom + view.ch / 2;
  if (sx < 60 || sx > view.cw - 60 || sy < 60 || sy > view.ch - 60) {
    const cx = view.cw / 2;
    const cy = view.ch / 2;
    const a = Math.atan2(sy - cy, sx - cx);
    const ex = cx + Math.cos(a) * (view.cw / 2 - 70);
    const ey = cy + Math.sin(a) * (view.ch / 2 - 70);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#fff3d6';
    ctx.fillText(`${Math.round(Math.hypot(target.x - state.player.x, target.y - state.player.y))}m`, ex, ey + 28);
  }
}

function drawLabels(ctx, state, view) {
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
    ctx.fillStyle = 'rgba(12, 10, 18, 0.55)';
    ctx.fillText(p.name, p.x + 8, p.y - 8);
  }
}

/** Draw one frame of the world. `view` carries canvas size and the camera. */
export function render(ctx, state, view) {
  const cam = state.camera;
  ctx.clearRect(0, 0, view.cw, view.ch);
  ctx.save();
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(view.cw / 2 / cam.zoom - cam.x, view.ch / 2 / cam.zoom - cam.y);
  const vis = {
    x0: cam.x - view.cw / 2 / cam.zoom - 40,
    y0: cam.y - view.ch / 2 / cam.zoom - 40,
    x1: cam.x + view.cw / 2 / cam.zoom + 40,
    y1: cam.y + view.ch / 2 / cam.zoom + 40,
    w: view.cw / cam.zoom + 80,
    h: view.ch / cam.zoom + 80,
    cw: view.cw,
    ch: view.ch,
  };
  drawGround(ctx, state, vis);
  drawRoads(ctx, state, vis);
  drawBuildings(ctx, state, vis);
  drawPalms(ctx, state, vis);
  // Skid marks, oldest first.
  ctx.strokeStyle = 'rgba(20, 16, 20, 0.35)';
  ctx.lineWidth = 4;
  for (const s of state.skids) {
    ctx.globalAlpha = Math.max(0, s.life / 6);
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawMarker(ctx, state, vis);
  for (const car of state.cars) {
    if (car.x < vis.x0 || car.x > vis.x1 || car.y < vis.y0 || car.y > vis.y1) continue;
    drawCar(ctx, car, state);
  }
  for (const ped of state.peds) {
    if (ped.x < vis.x0 || ped.x > vis.x1 || ped.y < vis.y0 || ped.y > vis.y1) continue;
    drawPed(ctx, ped, state);
  }
  drawPlayer(ctx, state);
  // Particles.
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Gun tracers.
  for (const t of state.tracers) {
    ctx.globalAlpha = Math.max(0, t.life / 0.09);
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawLabels(ctx, state, vis);
  ctx.restore();
  // Warm late-afternoon tint over the whole frame.
  const grad = ctx.createRadialGradient(view.cw / 2, view.ch / 2, view.ch * 0.3, view.cw / 2, view.ch / 2, view.ch * 0.9);
  grad.addColorStop(0, 'rgba(255, 150, 60, 0.04)');
  grad.addColorStop(1, 'rgba(60, 20, 80, 0.16)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, view.cw, view.ch);
}
