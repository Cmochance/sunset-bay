// The story of Sunset Bay: five jobs from fixer Mara Voss, from a first stolen
// car to a harbour heist. A mission is a list of steps; each step names what
// has to happen, and the update below watches for it and advances the job.

import { MISSION_REWARD } from './config.js';
import { PLACES } from './world.js';
import { dist2 } from './utils.js';
import { addWanted } from './police.js';

export const STORY_INTRO = 'Sunset Bay, 6:47 PM. Rex Marlowe is back in town with fifty bucks, a dead phone and a fixer named Mara Voss who always has one more job.';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Mara Voss',
    briefing: 'Borrow a car — any car — and bring it to Sunset Paint & Body so we can make it yours.',
    reward: MISSION_REWARD[0],
    steps: [
      { kind: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { kind: 'goto', place: 'paintShop', text: 'Drive to Sunset Paint & Body' },
    ],
  },
  {
    id: 'sunset-delivery',
    title: 'Sunset Delivery',
    giver: 'Mara Voss',
    briefing: 'A package is waiting at the Marina Docks. Pick it up and get it to the Palms Hotel — ninety seconds, no excuses.',
    reward: MISSION_REWARD[1],
    steps: [
      { kind: 'goto', place: 'marina', text: 'Pick up the package at the Marina Docks' },
      { kind: 'timedGoto', place: 'hotel', time: 90, text: 'Deliver to the Palms Hotel before the clock runs out' },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    giver: 'Mara Voss',
    briefing: 'The Bay PD needs a reminder. Get three stars on your tail, then shake them — lose the heat completely.',
    reward: MISSION_REWARD[2],
    steps: [
      { kind: 'wanted', stars: 3, text: 'Get the heat up to 3 stars (steal, smash, shoot — your call)' },
      { kind: 'loseWanted', text: 'Lose the heat — hide, or visit the paint shop ($50)' },
    ],
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    giver: 'Mara Voss',
    briefing: 'Tide Bar, beachfront. A briefcase is waiting under the third stool. Grab it and take it to Bay Tower — and don\'t let the cops see you carrying it.',
    reward: MISSION_REWARD[3],
    steps: [
      { kind: 'pickup', place: 'beachBar', text: 'Grab the briefcase at Tide Bar (press E)' },
      { kind: 'goto', place: 'tower', text: 'Deliver the briefcase to Bay Tower' },
    ],
  },
  {
    id: 'harbor-heist',
    title: 'Harbor Heist',
    giver: 'Mara Voss',
    briefing: 'The Golden Gull keeps its weekend take in a back room. Grab it, then get to the Harbor Docks with four stars on you and make the boat.',
    reward: MISSION_REWARD[4],
    steps: [
      { kind: 'goto', place: 'casino', text: 'Get into the Golden Gull Casino and grab the take' },
      { kind: 'goto', place: 'docks', text: 'Escape to the Harbor Docks — the boat is waiting' },
    ],
  },
];

/** Fresh mission progress: first mission, first step. */
export function createMissionState() {
  return { index: 0, step: 0, timer: 0, started: false, done: false };
}

/** The step the player is on right now, or null when the story is finished. */
export function currentStep(mission) {
  if (mission.index >= MISSIONS.length) return null;
  return MISSIONS[mission.index].steps[mission.step];
}

/** The mission the player is on right now, or null when finished. */
export function currentMission(mission) {
  if (mission.index >= MISSIONS.length) return null;
  return MISSIONS[mission.index];
}

/** The place the current step points at, or null when it points nowhere. */
export function currentTarget(mission) {
  const step = currentStep(mission);
  if (!step || !step.place) return null;
  return PLACES[step.place];
}

/** One line of objective text for the HUD. */
export function objectiveText(mission) {
  const m = currentMission(mission);
  if (!m) return 'Story complete — Sunset Bay is yours. Free roam!';
  const step = currentStep(mission);
  return `${m.title} — ${step.text}`;
}

function atPlace(state, place, radius) {
  const p = PLACES[place];
  const px = state.player.car ? state.player.car.x : state.player.x;
  const py = state.player.car ? state.player.car.y : state.player.y;
  return dist2(px, py, p.x, p.y) < radius * radius;
}

/**
 * Advance the mission state for one frame. Returns 'step', 'complete',
 * 'failed' or null. `input` is only needed for pickup steps (press E).
 */
export function updateMissions(state, input, dt, audio) {
  const mission = state.mission;
  if (mission.index >= MISSIONS.length) return null;
  const m = MISSIONS[mission.index];
  const step = m.steps[mission.step];

  // Start the mission timer the first frame a timed step is current.
  if (step.kind === 'timedGoto' && mission.timer <= 0 && !mission.timerStarted) {
    mission.timer = step.time;
    mission.timerStarted = true;
  }
  if (step.kind === 'timedGoto') {
    mission.timer -= dt;
    if (mission.timer <= 0) {
      mission.step = 0;
      mission.timer = 0;
      mission.timerStarted = false;
      if (audio) audio.fail();
      state.messages.push({ text: 'Too slow — the delivery window closed. Try again.', t: 5 });
      return 'failed';
    }
  }

  let done = false;
  if (step.kind === 'steal') {
    done = state.player.car !== null;
  } else if (step.kind === 'goto' || step.kind === 'timedGoto') {
    done = atPlace(state, step.place, 90);
  } else if (step.kind === 'pickup') {
    done = atPlace(state, step.place, 70) && input.pressed('enter');
  } else if (step.kind === 'wanted') {
    done = state.wanted >= step.stars;
  } else if (step.kind === 'loseWanted') {
    done = state.wanted === 0;
  }

  if (!done) return null;

  // The heist pays for itself in heat: grabbing the take brings four stars.
  if (m.id === 'harbor-heist' && mission.step === 0) {
    addWanted(state, 4);
    state.messages.push({ text: 'The take is yours — and the whole Bay PD knows it!', t: 4 });
  }
  if (audio) audio.pickup();
  mission.step += 1;
  mission.timer = 0;
  mission.timerStarted = false;

  if (mission.step >= m.steps.length) {
    state.player.cash += m.reward;
    state.player.ammo = Math.min(48, state.player.ammo + 12);
    state.stats.missionsDone += 1;
    if (audio) audio.mission();
    state.messages.push({ text: `Job done: ${m.title} — +$${m.reward}`, t: 5 });
    mission.index += 1;
    mission.step = 0;
    if (mission.index >= MISSIONS.length) {
      mission.done = true;
      state.screen = 'complete';
      return 'complete';
    }
    const next = MISSIONS[mission.index];
    state.messages.push({ text: `New job: ${next.title} — ${next.briefing}`, t: 7 });
    return 'complete';
  }
  return 'step';
}
