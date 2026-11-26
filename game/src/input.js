// Keyboard and mouse input. Keys are tracked by code; the mouse steers pitch and roll while the
// pointer is locked (click the canvas to lock). Edge-triggered actions (flaps, camera, pause,
// mute, drop, confirm) are consumed once. Axes are read every frame.
export function createInput(canvas) {
  const keys = new Set();
  let mousePitch = 0;
  let mouseRoll = 0;
  let locked = false;
  const edges = { flaps: false, camera: false, pause: false, mute: false, drop: false, confirm: false, gear: false, select: -1 };

  const onKeyDown = (e) => {
    const c = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ControlLeft', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyF', 'KeyB', 'KeyC', 'KeyP', 'KeyM'].includes(c)) e.preventDefault();
    if (!keys.has(c)) {
      if (c === 'KeyF') edges.flaps = true;
      else if (c === 'KeyC') edges.camera = true;
      else if (c === 'KeyP') edges.pause = true;
      else if (c === 'KeyM') edges.mute = true;
      else if (c === 'Space') edges.drop = true;
      else if (c === 'Enter') edges.confirm = true;
      else if (/^Digit[1-9]$/.test(c)) edges.select = Number(c.slice(5)) - 1;
    }
    keys.add(c);
  };
  const onKeyUp = (e) => keys.delete(e.code);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const onMouseMove = (e) => {
    if (!locked) return;
    mouseRoll = clamp(mouseRoll + e.movementX * 0.0022, -1, 1);
    mousePitch = clamp(mousePitch + e.movementY * 0.0022, -1, 1);
  };
  const onLock = () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) {
      mousePitch = 0;
      mouseRoll = 0;
    }
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onLock);
  canvas.addEventListener('click', () => {
    if (!locked) canvas.requestPointerLock();
  });

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const down = (...codes) => codes.some((c) => keys.has(c));

  return {
    get locked() {
      return locked;
    },
    /** -1 (nose down / push) .. 1 (nose up / pull). ArrowDown pulls up, ArrowUp pushes. */
    pitch() {
      let v = (down('ArrowDown') ? 1 : 0) - (down('ArrowUp') ? 1 : 0);
      v += mousePitch;
      return clamp(v, -1, 1);
    },
    /** -1 (roll left) .. 1 (roll right). */
    roll() {
      let v = (down('ArrowRight') ? 1 : 0) - (down('ArrowLeft') ? 1 : 0);
      v += mouseRoll;
      return clamp(v, -1, 1);
    },
    /** -1 (yaw left) .. 1 (yaw right). */
    yaw() {
      return (down('KeyD') ? 1 : 0) - (down('KeyA') ? 1 : 0);
    },
    /** Throttle change per second: +1 up (W / Shift), -1 down (S / Ctrl). */
    dThrottle() {
      return (down('KeyW', 'ShiftLeft') ? 1 : 0) - (down('KeyS', 'ControlLeft') ? 1 : 0);
    },
    flaps() {
      return edges.flaps;
    },
    takeFlaps() {
      const v = edges.flaps;
      edges.flaps = false;
      return v;
    },
    takeSelect() {
      const v = edges.select;
      edges.select = -1;
      return v;
    },
    brakes() {
      return down('KeyB');
    },
    takeCamera() {
      const v = edges.camera;
      edges.camera = false;
      return v;
    },
    takePause() {
      const v = edges.pause;
      edges.pause = false;
      return v;
    },
    takeMute() {
      const v = edges.mute;
      edges.mute = false;
      return v;
    },
    takeDrop() {
      const v = edges.drop;
      edges.drop = false;
      return v;
    },
    takeConfirm() {
      const v = edges.confirm;
      edges.confirm = false;
      return v;
    },
    /** Decay the mouse stick toward centre (called each frame). */
    decayMouse(dt) {
      const k = Math.min(1, dt * 2.4);
      mousePitch += (0 - mousePitch) * k;
      mouseRoll += (0 - mouseRoll) * k;
    },
    clearEdges() {
      for (const k in edges) edges[k] = false;
    },
  };
}