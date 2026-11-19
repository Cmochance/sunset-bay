// Everything drawn on top of the world: health, cash, wanted stars, the
// minimap, the current job, message toasts and the title, pause, wasted,
// busted and finale screens. All canvas, no DOM, so screenshots capture it.

import { WORLD, PALETTE } from './config.js';
import { currentMission, currentStep, objectiveText } from './missions.js';
import { loadGame } from './save.js';
import { PLACES } from './world.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 8);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

function drawStars(ctx, state, cw) {
  const n = state.wanted;
  const size = 26;
  const gap = 8;
  const total = 5 * size + 4 * gap;
  const x0 = (cw - total) / 2;
  const y = 14;
  for (let i = 0; i < 5; i += 1) {
    const x = x0 + i * (size + gap);
    drawStar(ctx, x + size / 2, y + size / 2, size / 2, i < n ? '#ffb13d' : 'rgba(255, 255, 255, 0.25)');
  }
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawMinimap(ctx, state, cw) {
  const size = 180;
  const x0 = cw - size - 16;
  const y0 = 16;
  const s = size / WORLD.width;
  panel(ctx, x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#5a7a4a';
  ctx.fillRect(x0, y0, size, size);
  // Water at the south edge.
  ctx.fillStyle = '#2e7f9e';
  ctx.fillRect(x0, y0 + size - 6, size, 6);
  // Roads.
  ctx.strokeStyle = '#3c3a44';
  ctx.lineWidth = 3;
  for (const rx of state.world.vertical) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * s, y0);
    ctx.lineTo(x0 + rx * s, y0 + size);
    ctx.stroke();
  }
  for (const ry of state.world.horizontal) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * s);
    ctx.lineTo(x0 + size, y0 + ry * s);
    ctx.stroke();
  }
  // Cars as grey dots, police as red.
  ctx.fillStyle = '#d8d8d8';
  for (const car of state.cars) {
    if (car.driver === 'player') continue;
    ctx.fillRect(x0 + car.x * s - 1, y0 + car.y * s - 1, 3, 3);
  }
  ctx.fillStyle = '#ff4d4d';
  for (const car of state.police) {
    ctx.beginPath();
    ctx.arc(x0 + car.x * s, y0 + car.y * s, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission target.
  const step = currentStep(state.mission);
  if (step && step.place) {
    const p = PLACES[step.place];
    ctx.fillStyle = '#ffb13d';
    ctx.save();
    ctx.translate(x0 + p.x * s, y0 + p.y * s);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  // The player: a white arrow that turns with them.
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  const ang = p.car ? p.car.angle : p.angle;
  ctx.save();
  ctx.translate(x0 + px * s, y0 + py * s);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#fff3d6';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('SUNSET BAY', x0 + size, y0 + size + 18);
}

function drawStatus(ctx, state) {
  const p = state.player;
  panel(ctx, 16, 14, 230, 78);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff3d6';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`$${p.cash}`, 30, 42);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#ffd9a0';
  ctx.fillText(p.car ? `Car  ${Math.round(Math.abs(p.car.speed) * 0.12)} mph` : 'On foot', 30, 62);
  if (!p.car) ctx.fillText(`Ammo  ${p.ammo}`, 150, 62);
  // Health bar.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(30, 70, 150, 10);
  ctx.fillStyle = p.health > 40 ? '#7dff8a' : '#ff4d4d';
  ctx.fillRect(30, 70, 150 * (p.health / 100), 10);
  ctx.fillStyle = '#fff3d6';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('HEALTH', 188, 79);
  if (state.bustTimer > 0) {
    ctx.fillStyle = '#ff4d4d';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('THE COPS ARE ON YOU — RUN!', 30, 112);
  }
}

function drawObjective(ctx, state, ch) {
  const m = currentMission(state.mission);
  const y = ch - 86;
  panel(ctx, 16, y, 420, 70);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffb13d';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(m ? `JOB ${state.mission.index + 1}/5 — ${m.title}` : 'FREE ROAM', 30, y + 22);
  ctx.fillStyle = '#fff3d6';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(objectiveText(state.mission), 30, y + 44);
  const step = currentStep(state.mission);
  if (step && step.kind === 'timedGoto' && state.mission.timer > 0) {
    ctx.fillStyle = state.mission.timer < 15 ? '#ff4d4d' : '#7dff8a';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`${Math.ceil(state.mission.timer)}s`, 380, y + 44);
  }
}

function drawToasts(ctx, state, cw, ch) {
  ctx.textAlign = 'center';
  let y = ch - 110;
  for (let i = state.messages.length - 1; i >= 0; i -= 1) {
    const msg = state.messages[i];
    const alpha = Math.min(1, msg.t);
    ctx.globalAlpha = alpha;
    ctx.font = '14px system-ui, sans-serif';
    const w = ctx.measureText(msg.text).width + 24;
    panel(ctx, (cw - w) / 2, y - 20, w, 28);
    ctx.fillStyle = '#fff3d6';
    ctx.fillText(msg.text, cw / 2, y);
    ctx.globalAlpha = 1;
    y -= 34;
  }
}

function drawPrompt(ctx, state, cw, ch) {
  const prompt = state.prompt;
  if (!prompt) return;
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  const w = ctx.measureText(prompt).width + 28;
  panel(ctx, (cw - w) / 2, ch - 150, w, 32);
  ctx.fillStyle = '#ffb13d';
  ctx.fillText(prompt, cw / 2, ch - 128);
}

function drawHint(ctx, state, cw, ch) {
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 243, 214, 0.75)';
  ctx.font = '12px system-ui, sans-serif';
  const inCar = state.player.car ? 'W/S drive  A/D steer  E exit  Space handbrake' : 'WASD move  Shift run  E enter car  Space punch  F / click shoot';
  ctx.fillText(inCar, cw - 16, ch - 16);
  ctx.fillText('P pause  M mute  Q save', cw - 16, ch - 32);
}

function overlay(ctx, cw, ch, alpha) {
  ctx.fillStyle = `rgba(10, 6, 16, ${alpha})`;
  ctx.fillRect(0, 0, cw, ch);
}

function bigText(ctx, text, cw, y, size, color) {
  ctx.textAlign = 'center';
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(text, cw / 2, y);
}

function smallText(ctx, text, cw, y, color) {
  ctx.textAlign = 'center';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = color || '#fff3d6';
  ctx.fillText(text, cw / 2, y);
}

/** Draw the HUD over a playing frame. */
export function drawHud(ctx, state, view) {
  drawStars(ctx, state, view.cw);
  drawStatus(ctx, state);
  drawMinimap(ctx, state, view.cw);
  drawObjective(ctx, state, view.ch);
  drawToasts(ctx, state, view.cw, view.ch);
  drawPrompt(ctx, state, view.cw, view.ch);
  drawHint(ctx, state, view.cw, view.ch);
}

/** Draw the title screen over the drifting city. */
export function drawTitle(ctx, state, view) {
  overlay(ctx, view.cw, view.ch, 0.45);
  const grad = ctx.createLinearGradient(0, view.ch * 0.2, 0, view.ch * 0.62);
  grad.addColorStop(0, '#ffb13d');
  grad.addColorStop(0.55, '#ff7a5c');
  grad.addColorStop(1, '#8a4a9e');
  ctx.textAlign = 'center';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillStyle = grad;
  ctx.fillText('SUNSET BAY', view.cw / 2, view.ch * 0.42);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#fff3d6';
  ctx.fillText('An open-world crime game — drive, steal, outrun the Bay PD', view.cw / 2, view.ch * 0.42 + 42);
  smallText(ctx, 'Rex Marlowe is back in town. Mara Voss has five jobs for him.', view.cw / 2, view.ch * 0.42 + 78);
  const save = loadGame();
  if (save) {
    smallText(ctx, `Continue: job ${Math.min(save.missionIndex + 1, 5)}/5, $${save.cash} in pocket — press ENTER`, view.cw / 2, view.ch * 0.62, '#7dff8a');
    smallText(ctx, 'N — new game', view.cw / 2, view.ch * 0.62 + 26, '#ffd9a0');
  } else {
    smallText(ctx, 'Press ENTER to start', view.cw / 2, view.ch * 0.62, '#7dff8a');
  }
  smallText(ctx, 'WASD move/drive · E enter & steal cars · Space punch · F shoot · P pause · Q save', view.cw / 2, view.ch * 0.62 + 58, '#ffd9a0');
  smallText(ctx, 'All content is original. Nothing here belongs to Rockstar Games.', view.cw / 2, view.ch - 24, 'rgba(255, 243, 214, 0.6)');
}

export function drawPaused(ctx, view) {
  overlay(ctx, view.cw, view.ch, 0.6);
  bigText(ctx, 'PAUSED', view.cw, view.ch / 2 - 10, 54, '#fff3d6');
  smallText(ctx, 'P or Esc to resume · Q to save · M to mute', view.cw, view.ch / 2 + 30);
}

export function drawWasted(ctx, state, view) {
  overlay(ctx, view.cw, view.ch, 0.55);
  bigText(ctx, 'WASTED', view.cw, view.ch / 2 - 10, 72, '#ff4d4d');
  smallText(ctx, `You wake up at St. Marisol Hospital, $${Math.floor(state.player.cash * 0.2)} lighter.`, view.cw, view.ch / 2 + 34);
  smallText(ctx, 'Press ENTER to get back on your feet', view.cw, view.ch / 2 + 62, '#7dff8a');
}

export function drawBusted(ctx, state, view) {
  overlay(ctx, view.cw, view.ch, 0.55);
  bigText(ctx, 'BUSTED', view.cw, view.ch / 2 - 10, 72, '#3b82ff');
  smallText(ctx, 'The Bay PD books you, keeps some of your cash, and lets you walk.', view.cw, view.ch / 2 + 34);
  smallText(ctx, 'Press ENTER to walk out of the station', view.cw, view.ch / 2 + 62, '#7dff8a');
}

export function drawComplete(ctx, state, view) {
  overlay(ctx, view.cw, view.ch, 0.6);
  bigText(ctx, 'SUNSET BAY LEGEND', view.cw, view.ch / 2 - 40, 56, '#ffb13d');
  smallText(ctx, 'All five jobs done. The harbour boat is gone, the take is yours,', view.cw, view.ch / 2 + 4);
  smallText(ctx, 'and Mara Voss is already planning the next one.', view.cw, view.ch / 2 + 28);
  smallText(ctx, `Cars stolen: ${state.stats.carsStolen} · Missions: ${state.stats.missionsDone}/5 · Cash: $${state.player.cash}`, view.cw, view.ch / 2 + 66, '#7dff8a');
  smallText(ctx, 'Press ENTER to keep roaming Sunset Bay', view.cw, view.ch / 2 + 96);
}
