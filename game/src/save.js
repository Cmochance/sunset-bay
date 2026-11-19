// Saving: one localStorage key holds the player's cash, the mission they are
// on, and their lifetime stats. Position is not saved — every session starts
// at the safehouse, the way a new day in Sunset Bay should.

import { SAVE_KEY } from './config.js';

/** Write the current progress to localStorage. Returns true on success. */
export function saveGame(state) {
  try {
    const data = {
      version: 1,
      cash: state.player.cash,
      ammo: state.player.ammo,
      missionIndex: state.mission.index,
      stats: state.stats,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Read a saved game, or null when there is none or it is unreadable. */
export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

/** Apply a loaded save to a fresh state. */
export function applySave(state, data) {
  state.player.cash = data.cash;
  state.player.ammo = data.ammo;
  state.mission.index = data.missionIndex;
  state.mission.step = 0;
  state.stats = { ...state.stats, ...data.stats };
}

/** Erase the save (used from the title screen's New Game choice). */
export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
