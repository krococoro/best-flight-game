// Kestrel Post — controls: keyboard yoke and throttle, mouse for menus.
// One job: turn raw key and pointer state into the flight model's input
// (pitch, roll, throttleDelta, brake) plus one-shot UI actions.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys that went down since the last frame
  let click = null; // { x, y } in stage coordinates, consumed by the UI

  function stagePos(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((evt.clientX - rect.left) / rect.width) * 1280,
      y: ((evt.clientY - rect.top) / rect.height) * 800,
    };
  }

  window.addEventListener('keydown', (evt) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(evt.code)) {
      evt.preventDefault();
    }
    if (!keys.has(evt.code)) pressed.add(evt.code);
    keys.add(evt.code);
  });
  window.addEventListener('keyup', (evt) => keys.delete(evt.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', (evt) => {
    click = stagePos(evt);
  });

  return {
    // Continuous flight input for one step.
    flight() {
      let pitch = 0;
      let roll = 0;
      if (keys.has('ArrowUp') || keys.has('KeyS')) pitch -= 1; // push: nose down
      if (keys.has('ArrowDown') || keys.has('KeyW')) pitch += 1; // pull: nose up
      if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;
      let throttleDelta = 0;
      if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Equal')) throttleDelta += 1;
      if (keys.has('ControlLeft') || keys.has('Minus')) throttleDelta -= 1;
      return {
        pitch,
        roll,
        throttleDelta,
        brake: keys.has('KeyB') || keys.has('Space'),
      };
    },
    // One-shot: was this code pressed since the last call?
    tapped(code) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
      return false;
    },
    takeClick() {
      const c = click;
      click = null;
      return c;
    },
    clearPressed() {
      pressed.clear();
    },
  };
}
