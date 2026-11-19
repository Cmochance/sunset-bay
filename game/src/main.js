// Sunset Bay: the game loop and the state machine. Fixed timestep, one state
// object passed everywhere, screens for title / playing / paused / wasted /
// busted / complete. The loop renders the world behind every screen, so the
// title drifts over the city and the finale keeps the city alive underneath.

import { STEP, WORLD, CAR, PLAYER } from './config.js';
import { createRng, clamp, dist2, lerp } from './utils.js';
import { createWorld, PLACES, collideBuildings } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, movePlayerOnFoot, updatePed, updateTrafficCar, createPed, maintainPopulation, separateCars, scarePeds } from './entities.js';
import { driveCar, enterCar, exitCar, damageCar } from './vehicles.js';
import { maintainPolice, updatePolice, tryPaintShop, commitCrime, clearWanted, witnessed } from './police.js';
import { punch, shoot, hurtPlayer, regenPlayer } from './combat.js';
import { createMissionState, updateMissions, currentStep } from './missions.js';
import { saveGame, loadGame, applySave, clearSave } from './save.js';
import { render } from './render.js';
import { drawHud, drawTitle, drawPaused, drawWasted, drawBusted, drawComplete } from './hud.js';
import { shotFromUrl, setupShot, updateShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const input = createInput();
input.attach();
const audio = createAudio();
window.addEventListener('keydown', () => audio.unlock(), { once: true });
window.addEventListener('mousedown', () => audio.unlock(), { once: true });

const SEED = 20261119;
const rng = createRng(SEED);
const world = createWorld(SEED);

const state = {
  screen: 'title',
  time: 0,
  world,
  rng,
  player: createPlayer(PLACES.safehouse.x, PLACES.safehouse.y),
  cars: [],
  peds: [],
  police: [],
  wanted: 0,
  wantedTimer: 0,
  bustTimer: 0,
  mission: createMissionState(),
  messages: [],
  particles: [],
  tracers: [],
  skids: [],
  camera: { x: PLACES.safehouse.x, y: PLACES.safehouse.y, zoom: 1 },
  stats: { carsStolen: 0, missionsDone: 0, shotsFired: 0 },
  prompt: null,
  shot: null,
  autosaveTimer: 30,
  saveNotice: 0,
};

// Populate the street once at boot so the title screen already shows a city.
maintainPopulation(state, rng);
for (let i = 0; i < 6; i += 1) state.peds.push(createPed(world, rng));

function respawnAt(place, keepCar) {
  const p = state.player;
  p.x = place.x;
  p.y = place.y;
  p.health = PLAYER.health;
  p.angle = -Math.PI / 2;
  if (!keepCar) p.car = null;
  state.camera.x = p.x;
  state.camera.y = p.y;
}

function startGame(fresh) {
  state.mission = createMissionState();
  state.player = createPlayer(PLACES.safehouse.x, PLACES.safehouse.y);
  state.cars = [];
  state.peds = [];
  state.police = [];
  state.wanted = 0;
  state.wantedTimer = 0;
  state.bustTimer = 0;
  state.messages = [];
  state.particles = [];
  state.tracers = [];
  state.skids = [];
  state.stats = { carsStolen: 0, missionsDone: 0, shotsFired: 0 };
  state.camera = { x: PLACES.safehouse.x, y: PLACES.safehouse.y, zoom: 1 };
  maintainPopulation(state, rng);
  if (!fresh) {
    const save = loadGame();
    if (save) {
      applySave(state, save);
      state.messages.push({ text: `Welcome back, Rex. Job ${Math.min(save.missionIndex + 1, 5)}/5 — $${save.cash} in pocket.`, t: 6 });
    }
  }
  state.screen = 'playing';
  audio.unlock();
}

function nearestCar(maxDist) {
  const p = state.player;
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const d = dist2(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function updatePrompt() {
  const p = state.player;
  const step = currentStep(state.mission);
  if (step && step.kind === 'pickup' && dist2(p.x, p.y, PLACES[step.place].x, PLACES[step.place].y) < 70 * 70) {
    state.prompt = 'Press E to grab the briefcase';
    return;
  }
  if (!p.car) {
    const car = nearestCar(60);
    state.prompt = car ? (car.driver === 'ai' ? 'Press E to steal this car' : 'Press E to get in') : null;
    return;
  }
  if (state.wanted > 0 && dist2(p.car.x, p.car.y, PLACES.paintShop.x, PLACES.paintShop.y) < 90 * 90) {
    state.prompt = 'Paint shop — drive in to clear the heat ($50)';
    return;
  }
  state.prompt = null;
}

function stealOrEnter() {
  const car = nearestCar(60);
  if (!car) return;
  const wasTraffic = car.driver === 'ai';
  const displaced = enterCar(state.player, car);
  state.stats.carsStolen += 1;
  audio.pickup();
  if (displaced) {
    const ped = createPed(world, rng);
    ped.x = displaced.x;
    ped.y = displaced.y;
    ped.state = 'flee';
    ped.stateT = 3;
    state.peds.push(ped);
  }
  if (wasTraffic) {
    commitCrime(state, car.x, car.y, 1);
    scarePeds(state.peds, car.x, car.y, 200);
    state.messages.push({ text: 'You jacked a car — the city saw that.', t: 3 });
  } else {
    if (witnessed(state, car.x, car.y)) {
      commitCrime(state, car.x, car.y, 1);
      state.messages.push({ text: 'Someone saw you take that car.', t: 3 });
    }
  }
}

function updatePlaying(dt) {
  const p = state.player;

  if (input.pressed('pause')) { state.screen = 'paused'; return; }
  if (input.pressed('mute')) {
    const muted = audio.toggleMute();
    state.messages.push({ text: muted ? 'Sound off' : 'Sound on', t: 2 });
  }
  if (input.pressed('save')) {
    saveGame(state);
    state.messages.push({ text: 'Game saved.', t: 2 });
  }

  // Shot mode: the autopilot drives; the world still simulates around it.
  if (state.shot && !state.shot.done) {
    updateShot(state, dt);
  } else if (p.car) {
    // Driving.
    const throttle = (input.held('up') ? 1 : 0) + (input.held('down') ? -0.7 : 0);
    const steer = (input.held('left') ? -1 : 0) + (input.held('right') ? 1 : 0);
    const prevX = p.car.x;
    const prevY = p.car.y;
    driveCar(p.car, { throttle, steer }, dt);
    if (input.held('punch')) p.car.speed *= 0.94; // Space: handbrake.
    const fixed = collideBuildings(world, p.car.x, p.car.y, 26);
    if (Math.abs(fixed.x - p.car.x) + Math.abs(fixed.y - p.car.y) > 1) {
      if (Math.abs(p.car.speed) > 160) audio.crash();
      p.car.speed *= 0.4;
    }
    p.car.x = fixed.x;
    p.car.y = fixed.y;
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    if (p.car.skid) {
      state.skids.push({ x1: prevX, y1: prevY, x2: p.car.x, y2: p.car.y, life: 6 });
      if (state.skids.length > 500) state.skids.shift();
    }
    if (p.car.wrecked) {
      p.car.driver = 'none';
      p.car.kind = 'parked';
      p.car = null;
      state.messages.push({ text: 'Your car is wrecked. On foot now.', t: 3 });
    }
    audio.engine(Math.abs(p.car ? p.car.speed : 0) / CAR.maxSpeed);
    if (input.pressed('enter')) {
      exitCar(p);
      audio.engineOff();
    }
    if (tryPaintShop(state)) {
      state.messages.push({ text: 'New paint, new plates — the heat is gone. -$50', t: 4 });
      audio.coin();
    }
  } else {
    // On foot.
    audio.engineOff();
    movePlayerOnFoot(p, world, input, dt);
    if (input.pressed('punch')) punch(state, audio);
    if (input.pressed('shoot') || input.mouse.pressed) {
      const wx = state.camera.x + (input.mouse.x - canvas.width / 2) / state.camera.zoom;
      const wy = state.camera.y + (input.mouse.y - canvas.height / 2) / state.camera.zoom;
      const aim = Math.atan2(wy - p.y, wx - p.x);
      p.angle = aim;
      const hit = shoot(state, aim, audio);
      if (hit) state.stats.shotsFired += 1;
    }
    if (input.pressed('enter')) stealOrEnter();
  }

  if (p.punchTimer > 0) p.punchTimer -= dt;
  regenPlayer(p, dt);

  // Pedestrians: walk, flee, and get removed once a body has lain long enough.
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (ped.down > 100) {
      ped.down -= dt * 100; // a killed ped lies for about nine seconds
      if (ped.down <= 100) { state.peds.splice(i, 1); continue; }
      continue;
    }
    const danger = { x: p.x, y: p.y };
    if (p.car && Math.abs(p.car.speed) > 150 && dist2(ped.x, ped.y, p.car.x, p.car.y) < 60 * 60) {
      ped.state = 'flee';
      ped.stateT = 2;
    }
    updatePed(world, rng, ped, danger, dt);
  }

  // Traffic.
  for (const car of state.cars) {
    if (car.kind === 'traffic') updateTrafficCar(world, rng, car, state.cars, dt);
  }

  // Cars hitting pedestrians.
  for (const car of state.cars) {
    if (car.wrecked) continue;
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      if (dist2(car.x, car.y, ped.x, ped.y) < 26 * 26) {
        ped.down = 999;
        if (car.driver === 'player') {
          commitCrime(state, ped.x, ped.y, 1);
          scarePeds(state.peds, ped.x, ped.y, 220);
          audio.crash();
          state.messages.push({ text: 'You hit a pedestrian — the city saw that.', t: 3 });
        } else if (car.kind === 'traffic') {
          scarePeds(state.peds, ped.x, ped.y, 200);
        }
      }
    }
  }

  // A traffic car running the player down on foot hurts.
  if (!p.car) {
    for (const car of state.cars) {
      if (car.kind === 'traffic' && Math.abs(car.speed) > 60 && dist2(car.x, car.y, p.x, p.y) < 30 * 30) {
        if (hurtPlayer(state, 12)) { state.screen = 'wasted'; }
        break;
      }
    }
  }

  separateCars(state.cars, audio);

  // Police and the wanted level.
  maintainPolice(state, rng, dt);
  if (state.wanted > 0) audio.siren(dt);
  const busted = updatePolice(state, dt);
  if (busted === 'busted') {
    const fine = Math.floor(p.cash * 0.2);
    p.cash -= fine;
    clearWanted(state);
    audio.fail();
    state.screen = 'busted';
    return;
  }

  // Wrecked cars smoke.
  for (const car of state.cars) {
    if (car.wrecked && rng() < 0.3) {
      state.particles.push({ x: car.x + (rng() - 0.5) * 20, y: car.y + (rng() - 0.5) * 20, vx: 0, vy: -18, life: 1.2, maxLife: 1.2, color: '#555', size: 5 });
    }
  }

  // Missions.
  const result = updateMissions(state, input, dt, audio);
  if (result === 'complete' && state.mission.done) {
    saveGame(state);
    return;
  }
  if (result === 'complete') saveGame(state);

  // Timers: messages, tracers, particles, skids.
  for (let i = state.messages.length - 1; i >= 0; i -= 1) {
    state.messages[i].t -= dt;
    if (state.messages[i].t <= 0) state.messages.splice(i, 1);
  }
  for (let i = state.tracers.length - 1; i >= 0; i -= 1) {
    state.tracers[i].life -= dt;
    if (state.tracers[i].life <= 0) state.tracers.splice(i, 1);
  }
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.skids.length - 1; i >= 0; i -= 1) {
    state.skids[i].life -= dt;
    if (state.skids[i].life <= 0) state.skids.splice(i, 1);
  }

  maintainPopulation(state, rng);

  // Autosave every thirty seconds.
  state.autosaveTimer -= dt;
  if (state.autosaveTimer <= 0) {
    state.autosaveTimer = 30;
    saveGame(state);
  }

  updatePrompt();

  // Camera follows the player, pulling back a little at speed.
  const targetZoom = p.car ? clamp(1.05 - Math.abs(p.car.speed) / 1600, 0.82, 1.05) : 1;
  state.camera.zoom = lerp(state.camera.zoom, targetZoom, 0.03);
  state.camera.x = lerp(state.camera.x, p.x, 0.12);
  state.camera.y = lerp(state.camera.y, p.y, 0.12);
}

function updateTitle(dt) {
  state.camera.x = 1600 + Math.cos(state.time * 0.05) * 620;
  state.camera.y = 1150 + Math.sin(state.time * 0.033) * 380;
  state.camera.zoom = 0.9;
  if (input.pressed('confirm')) {
    startGame(false);
  } else if (input.pressed('save')) {
    // N is bound to 'save' in the input map: new game from the title.
    clearSave();
    startGame(true);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = now - (frame.last || now);
  frame.last = now;
  const dt = Math.min(dtMs / 1000, 0.1);
  state.time += dt;

  // Fixed-step updates, capped so a slow frame never spirals.
  let acc = (frame.acc || 0) + dt;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    if (state.screen === 'playing') updatePlaying(STEP);
    else if (state.screen === 'title') updateTitle(STEP);
    acc -= STEP;
    steps += 1;
  }
  frame.acc = acc;

  // Screens that wait for a key.
  if (state.screen === 'paused' && input.pressed('pause')) state.screen = 'playing';
  if ((state.screen === 'wasted' || state.screen === 'busted') && input.pressed('confirm')) {
    const fine = Math.floor(state.player.cash * 0.2);
    if (state.screen === 'wasted') state.player.cash -= fine;
    clearWanted(state);
    respawnAt(state.screen === 'wasted' ? PLACES.hospital : PLACES.safehouse, false);
    state.screen = 'playing';
  }
  if (state.screen === 'complete' && input.pressed('confirm')) {
    state.screen = 'playing';
  }

  const view = { cw: canvas.width, ch: canvas.height };
  render(ctx, state, view);
  if (state.screen === 'playing') drawHud(ctx, state, view);
  else if (state.screen === 'title') drawTitle(ctx, state, view);
  else if (state.screen === 'paused') { drawHud(ctx, state, view); drawPaused(ctx, view); }
  else if (state.screen === 'wasted') drawWasted(ctx, state, view);
  else if (state.screen === 'busted') drawBusted(ctx, state, view);
  else if (state.screen === 'complete') drawComplete(ctx, state, view);

  input.update();
}

// Shot mode: skip the title screen and stage a scene for the camera.
const shotName = shotFromUrl();
if (shotName) {
  setupShot(state, shotName, rng);
}

requestAnimationFrame(frame);
