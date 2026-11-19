// Keyboard and mouse, read once a frame. Actions are edge-triggered (pressed
// this frame) so a held key does not repeat an action like entering a car.

export const ACTION = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  run: 'run',
  enter: 'enter',
  punch: 'punch',
  shoot: 'shoot',
  pause: 'pause',
  confirm: 'confirm',
  mute: 'mute',
  save: 'save',
};

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyE: 'enter',
  Space: 'punch',
  KeyF: 'shoot',
  KeyP: 'pause',
  Escape: 'pause',
  Enter: 'confirm',
  KeyM: 'mute',
  KeyQ: 'save',
  KeyN: 'save',
};

/** Create the input state; call attach() once to listen, update() each frame. */
export function createInput() {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, pressed: false };

  function onKeyDown(e) {
    const a = KEYMAP[e.code];
    if (!a) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
    if (!held.has(a)) pressed.add(a);
    held.add(a);
  }
  function onKeyUp(e) {
    const a = KEYMAP[e.code];
    if (a) held.delete(a);
  }
  function onMouseMove(e) { mouse.x = e.clientX; mouse.y = e.clientY; }
  function onMouseDown(e) {
    if (e.button === 0) { mouse.down = true; mouse.pressed = true; }
  }
  function onMouseUp(e) {
    if (e.button === 0) mouse.down = false;
  }

  return {
    mouse,
    attach() {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', onMouseUp);
    },
    /** True while the action's key is held. */
    held(a) { return held.has(a); },
    /** True only on the frame the action's key went down. */
    pressed(a) { return pressed.has(a); },
    /** Movement vector from the held keys, normalised. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (held.has('left')) x -= 1;
      if (held.has('right')) x += 1;
      if (held.has('up')) y -= 1;
      if (held.has('down')) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    /** Call at the end of each frame so pressed() is edge-triggered. */
    update() { pressed.clear(); mouse.pressed = false; },
  };
}
