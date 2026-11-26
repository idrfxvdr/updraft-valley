// Wires the valley together and runs the one loop: input is read, the flight model advances in
// fixed steps, the mission is judged, the camera follows, the world animates and the HUD is drawn.
// It also owns the screen flow (title, briefing, flying, paused, debrief), the ?shot= staging for
// deterministic screenshots, and the window.__game hooks the smoke test drives.
import * as THREE from 'three';
import { makeNoise } from './noise.js';
import { createTerrain, WORLD } from './terrain.js';
import { createSky } from './sky.js';
import { createAircraft } from './aircraft.js';
import { createFlight } from './flight.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createMission, MISSIONS } from './missions.js';
import { drawHUD } from './hud.js';
import { drawPanel } from './panel.js';
import { SCREEN, createState } from './state.js';

const STEP = 1 / 120;
const MAX_STEPS = 12;
const KN = 1.94384;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const hudCanvas = document.getElementById('hud');
const hudCtx = hudCanvas.getContext('2d');
const status = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 6500);

const noise = makeNoise(seed);
const terrain = createTerrain(scene, noise);
const sky = createSky(scene, renderer);
const aircraft = createAircraft();
scene.add(aircraft.group);
const flight = createFlight();
const cam = createCamera(camera);
const input = createInput(canvas);
const audio = createAudio();
const state = createState();
let mission = null;

let W = 1;
let H = 1;
let dpr = 1;

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  hudCanvas.width = Math.floor(W * dpr);
  hudCanvas.height = Math.floor(H * dpr);
  hudCanvas.style.width = `${W}px`;
  hudCanvas.style.height = `${H}px`;
}
window.addEventListener('resize', resize);
resize();

const fwdV = new THREE.Vector3();
const upV = new THREE.Vector3();
const rightV = new THREE.Vector3();
function axes() {
  fwdV.set(0, 0, -1).applyQuaternion(flight.state.quat);
  upV.set(0, 1, 0).applyQuaternion(flight.state.quat);
  rightV.set(1, 0, 0).applyQuaternion(flight.state.quat);
}

function syncAircraft() {
  aircraft.group.position.copy(flight.state.pos);
  aircraft.group.quaternion.copy(flight.state.quat);
}

function isOnRunway(x, z) {
  for (const r of WORLD.runways) {
    const dx = x - r.x;
    const dz = z - r.z;
    const c = Math.cos(r.hdg);
    const s = Math.sin(r.hdg);
    const lx = dx * c + dz * s;
    const lz = -dx * s + dz * c;
    if (Math.abs(lx) < r.wid / 2 + 4 && Math.abs(lz) < r.len / 2) return true;
  }
  return false;
}

function nextGoal() {
  if (!mission) return null;
  const id = mission.def.id;
  if (id === 'rings') {
    const r = terrain.rings.find((rr) => !rr.taken);
    return r ? { x: r.pos.x, z: r.pos.z } : null;
  }
  if (id === 'supply') {
    if (mission.phase < 2) return { x: WORLD.clearing.x, z: WORLD.clearing.z };
    const r = WORLD.runways[0];
    return { x: r.x, z: r.z };
  }
  if (id === 'ridge') {
    if (mission.phase === 0) return { x: 120, z: -40 };
    const r = WORLD.runways[1];
    return { x: r.x, z: r.z };
  }
  return null;
}

function buildResult(complete) {
  const st = flight.state;
  return {
    complete,
    time: mission ? mission.time : 0,
    fuel: st.fuel,
    grade: st.landingGrade ?? '—',
    damage: st.damage,
    score: mission ? mission.score : 0,
    missionName: mission ? mission.def.name : '',
  };
}

function startMission(index) {
  state.missionIndex = index;
  mission = createMission(MISSIONS[index].id, terrain);
  mission.reset(flight);
  state.result = null;
  state.setScreen(SCREEN.BRIEFING);
  announce(`${mission.def.name}. ${mission.def.blurb}`);
}

function beginFlight() {
  if (!mission) return;
  state.setScreen(SCREEN.FLYING);
  audio.resume();
  announce(`Flying ${mission.def.name}.`);
}

function endSortie(complete) {
  if (state.screen !== SCREEN.FLYING) return;
  state.result = buildResult(complete);
  state.setScreen(SCREEN.DEBRIEF);
  announce(complete ? 'Mission complete.' : 'Sortie ended.');
}

function announce(msg) {
  status.textContent = msg;
}

function view() {
  axes();
  const bank = Math.atan2(rightV.y, upV.y);
  return {
    st: flight.state,
    mission,
    mode: cam.mode,
    muted: audio.muted,
    world: terrain,
    nextGoal: nextGoal(),
    drawPanel,
    forwardY: fwdV.y,
    roll: bank,
  };
}

// ---- overlays ------------------------------------------------------------
function drawTitle(ctx) {
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(6,14,24,0.35)');
  g.addColorStop(1, 'rgba(6,14,24,0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffcf5a';
  ctx.shadowColor = '#ffcf5a';
  ctx.shadowBlur = 18;
  ctx.font = '800 64px ui-sans-serif, system-ui';
  ctx.fillText('UPDRAFT VALLEY', W / 2, H * 0.24);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#dff0f8';
  ctx.font = '500 20px ui-sans-serif, system-ui';
  ctx.fillText('a bush-plane flight over the green river valley', W / 2, H * 0.24 + 38);

  const n = MISSIONS.length;
  const cardW = 220;
  const cardH = 150;
  const gap = 22;
  const totalW = n * cardW + (n - 1) * gap;
  const x0 = W / 2 - totalW / 2;
  const y0 = H * 0.42;
  for (let i = 0; i < n; i += 1) {
    const m = MISSIONS[i];
    const x = x0 + i * (cardW + gap);
    const sel = i === state.missionIndex;
    ctx.fillStyle = sel ? 'rgba(255,207,90,0.16)' : 'rgba(10,20,30,0.62)';
    ctx.strokeStyle = sel ? '#ffcf5a' : 'rgba(120,200,230,0.35)';
    ctx.lineWidth = sel ? 3 : 1.5;
    roundRect(ctx, x, y0, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9fe0ff';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.fillText(`${i + 1}  ${m.tag}`, x + 18, y0 + 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px ui-sans-serif, system-ui';
    ctx.fillText(m.name, x + 18, y0 + 66);
    ctx.fillStyle = '#cfe6f2';
    ctx.font = '400 14px ui-sans-serif, system-ui';
    wrapText(ctx, m.blurb, x + 18, y0 + 94, cardW - 36, 18);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cfe6f2';
  ctx.font = '500 16px ui-monospace, monospace';
  ctx.fillText('Press 1 – 4 to choose a sortie   ·   arrows fly · mouse steers (click to lock) · C camera · P pause · M mute', W / 2, H - 40);
}

function drawBriefing(ctx) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(6,14,24,0.55)';
  ctx.fillRect(0, 0, W, H);
  const m = mission.def;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffcf5a';
  ctx.shadowColor = '#ffcf5a';
  ctx.shadowBlur = 14;
  ctx.font = '800 46px ui-sans-serif, system-ui';
  ctx.fillText(m.name.toUpperCase(), W / 2, H * 0.3);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#9fe0ff';
  ctx.font = '700 16px ui-monospace, monospace';
  ctx.fillText(m.tag, W / 2, H * 0.3 + 30);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '400 22px ui-sans-serif, system-ui';
  wrapText(ctx, m.blurb, W / 2, H * 0.3 + 80, 640, 30, 'center');
  ctx.fillStyle = '#cfe6f2';
  ctx.font = '500 18px ui-monospace, monospace';
  ctx.fillText('Press ENTER or SPACE to take off', W / 2, H * 0.72);
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(6,14,24,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffcf5a';
  ctx.font = '800 52px ui-sans-serif, system-ui';
  ctx.fillText('PAUSED', W / 2, H / 2);
  ctx.fillStyle = '#cfe6f2';
  ctx.font = '500 18px ui-monospace, monospace';
  ctx.fillText('Press P to resume', W / 2, H / 2 + 44);
}

function drawDebrief(ctx) {
  const r = state.result;
  ctx.fillStyle = 'rgba(6,14,24,0.62)';
  ctx.fillRect(0, 0, W, H);
  const w = 560;
  const h = 400;
  const x = W / 2 - w / 2;
  const y = H / 2 - h / 2;
  ctx.fillStyle = 'rgba(10,20,30,0.92)';
  ctx.strokeStyle = r.complete ? '#7dffa0' : '#ff8a7a';
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = r.complete ? '#7dffa0' : '#ff8a7a';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 12;
  ctx.font = '800 40px ui-sans-serif, system-ui';
  ctx.fillText(r.complete ? 'MISSION COMPLETE' : 'SORTIE ENDED', W / 2, y + 62);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#9fe0ff';
  ctx.font = '600 18px ui-monospace, monospace';
  ctx.fillText(r.missionName, W / 2, y + 92);

  const rows = [
    ['TIME', `${r.time.toFixed(1)} s`],
    ['FUEL LEFT', `${Math.round(r.fuel * 100)}%`],
    ['LANDING', r.grade],
    ['DAMAGE', `${Math.round(r.damage)}%`],
    ['SCORE', `${r.score}`],
  ];
  ctx.textAlign = 'left';
  for (let i = 0; i < rows.length; i += 1) {
    const ry = y + 140 + i * 42;
    ctx.fillStyle = '#8fd0e6';
    ctx.font = '600 18px ui-monospace, monospace';
    ctx.fillText(rows[i][0], x + 70, ry);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '700 22px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(rows[i][1], x + w - 70, ry);
    ctx.textAlign = 'left';
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cfe6f2';
  ctx.font = '500 16px ui-monospace, monospace';
  ctx.fillText('Press ENTER to return to the hangar', W / 2, y + h - 24);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH, align = 'left') {
  const words = text.split(' ');
  let line = '';
  const startY = y;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = align;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
  ctx.textAlign = prevAlign;
  return y - startY;
}

// ---- the world + render --------------------------------------------------
let clock = 0;
function updateWorld(dt) {
  clock += dt;
  terrain.update(dt);
  sky.update(dt);
  aircraft.update(dt, flight.state.throttle);
}

function render() {
  if (state.screen === SCREEN.TITLE || state.screen === SCREEN.BRIEFING) {
    const t = clock * 0.06;
    camera.position.set(Math.cos(t) * 1150, 540 + Math.sin(clock * 0.1) * 30, Math.sin(t) * 1150);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 120, 0);
  }
  renderer.render(scene, camera);

  hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.screen === SCREEN.FLYING || state.screen === SCREEN.PAUSED || state.screen === SCREEN.DEBRIEF) {
    drawHUD(hudCtx, W, H, view());
    if (state.screen === SCREEN.PAUSED) drawPause(hudCtx);
    if (state.screen === SCREEN.DEBRIEF) drawDebrief(hudCtx);
  } else if (state.screen === SCREEN.TITLE) {
    drawTitle(hudCtx);
  } else if (state.screen === SCREEN.BRIEFING) {
    drawBriefing(hudCtx);
  }
}

// ---- flying step ---------------------------------------------------------
let stepCount = 0;
function flyStep(dt, controls) {
  flight.step(dt, controls);
  const st = flight.state;
  const gy = terrain.heightAt(st.pos.x, st.pos.z);
  const onR = isOnRunway(st.pos.x, st.pos.z);
  const ev = flight.groundContact(gy, onR);
  if (ev === 'crashed') {
    endSortie(false);
    return;
  }
  // Tree / ridge strike while flying low.
  stepCount += 1;
  if (!st.onGround && st.pos.y - gy < 34 && stepCount % 4 === 0) {
    const pp = terrain.pinePositions;
    for (let i = 0; i < pp.length; i += 3) {
      const dx = st.pos.x - pp[i];
      const dz = st.pos.z - pp[i + 1];
      if (dx * dx + dz * dz < 36 && st.pos.y < pp[i + 2] + 26 && st.pos.y > pp[i + 2] - 2) {
        st.damage = 100;
        endSortie(false);
        return;
      }
    }
  }
  if (mission) {
    mission.update(dt, flight);
    if (mission.complete) endSortie(true);
    else if (mission.failed) endSortie(false);
  }
}

function handleGlobalKeys() {
  if (input.takeMute()) audio.setMuted(!audio.muted);
  if (input.takeCamera() && (state.screen === SCREEN.FLYING || state.screen === SCREEN.PAUSED)) {
    cam.toggle();
    state.cameraMode = cam.mode;
  }
  if (input.takePause()) {
    if (state.screen === SCREEN.FLYING) state.setScreen(SCREEN.PAUSED);
    else if (state.screen === SCREEN.PAUSED) state.setScreen(SCREEN.FLYING);
  }
}

function runGame() {
  let last = performance.now();
  let acc = 0;
  announce('Updraft Valley. Press 1 to 4 to choose a sortie.');

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    handleGlobalKeys();

    if (state.screen === SCREEN.TITLE) {
      const sel = input.takeSelect();
      if (sel >= 0) startMission(sel);
      else if (input.takeConfirm()) startMission(state.missionIndex);
    } else if (state.screen === SCREEN.BRIEFING) {
      if (input.takeConfirm() || input.takeDrop()) beginFlight();
      else if (input.takeSelect() >= 0) { /* ignore */ }
    } else if (state.screen === SCREEN.FLYING) {
      if (input.takeFlaps()) flight.state.flaps = flight.state.flaps > 0.5 ? 0 : 1;
      const controls = {
        pitch: input.pitch(),
        roll: input.roll(),
        yaw: input.yaw(),
        dThrottle: input.dThrottle(),
        flaps: 0,
        brakes: input.brakes(),
      };
      input.decayMouse(dt);
      if (input.takeDrop() && mission) mission.drop();
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < MAX_STEPS && state.screen === SCREEN.FLYING) {
        flyStep(STEP, controls);
        acc -= STEP;
        n += 1;
      }
      if (n >= MAX_STEPS) acc = 0;
      cam.update(dt, flight, terrain.heightAt);
    } else if (state.screen === SCREEN.DEBRIEF) {
      if (input.takeConfirm()) {
        state.setScreen(SCREEN.TITLE);
        mission = null;
        for (const r of terrain.rings) r.mesh.visible = false;
      }
    }

    updateWorld(dt);
    syncAircraft();
    audio.update(flight.state.throttle, flight.state.airspeed, flight.state.stall && state.screen === SCREEN.FLYING);
    render();
  }
  requestAnimationFrame(frame);

  // Smoke-test / debug hooks.
  window.__game = {
    startMission,
    beginFlight,
    state,
    flight,
    mission: () => mission,
    stepFor(seconds, throttle) {
      // Deterministic simulated flight used by the smoke test.
      const controls = { pitch: 0, roll: 0, yaw: 0, dThrottle: 0, flaps: 0, brakes: false };
      const steps = Math.round(seconds / STEP);
      for (let i = 0; i < steps; i += 1) {
        if (throttle !== undefined) flight.state.throttle = throttle;
        flyStep(STEP, controls);
      }
      syncAircraft();
      render();
      return { alt: flight.state.pos.y, speed: flight.state.airspeed, fuel: flight.state.fuel };
    },
    setScreen: (s) => state.setScreen(s),
  };
}

// ---- screenshot staging --------------------------------------------------
function placeFlight(opts) {
  flight.reset(opts);
  if (opts.vel) flight.state.vel.copy(opts.vel);
  syncAircraft();
}

function stageShot(name) {
  cam.setMode('chase');
  state.setScreen(SCREEN.FLYING);
  if (name === 'cover') {
    mission = createMission('rings', terrain);
    const r = terrain.rings[4];
    const dir = new THREE.Vector3(0, 0, 1);
    const pos = r.pos.clone().addScaledVector(dir, -150);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.3));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.06));
    placeFlight({ x: pos.x, y: pos.y + 4, z: pos.z, throttle: 0.82, fuel: 0.9 });
    flight.state.quat.copy(q);
    flight.state.vel.set(0, 0, 56).applyQuaternion(q);
    for (const rr of terrain.rings) rr.mesh.visible = true;
    mission.ringsTaken = 3;
    for (let i = 0; i < 3; i += 1) { terrain.rings[i].taken = true; terrain.rings[i].mesh.visible = false; }
  } else if (name === 'approach') {
    mission = createMission('supply', terrain);
    const r = WORLD.runways[0];
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    placeFlight({ x: r.x, y: r.y + 42, z: r.z + 300, throttle: 0.34, fuel: 0.8, flaps: 1 });
    flight.state.quat.copy(q);
    flight.state.vel.set(0, -1.4, -38).applyQuaternion(q);
    mission.phase = 2;
    mission.goal = 'Return to Valley Strip and land';
  } else if (name === 'cockpit') {
    mission = createMission('free', terrain);
    cam.setMode('cockpit');
    placeFlight({ x: -120, y: 300, z: 700, throttle: 0.72, fuel: 0.85 });
    flight.state.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 0.95);
    flight.state.vel.set(0, 0, 52).applyQuaternion(flight.state.quat);
    mission.goal = 'Explore the valley — land to finish';
  } else if (name === 'debrief') {
    mission = createMission('supply', terrain);
    const r = WORLD.runways[0];
    placeFlight({ x: r.x, y: r.y + 1.55, z: r.z, throttle: 0, fuel: 0.62, onGround: true });
    flight.state.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    flight.state.landingGrade = 'A';
    flight.state.damage = 6;
    mission.complete = true;
    mission.score = 1180;
    mission.time = 74.3;
    state.result = {
      complete: true,
      time: 74.3,
      fuel: 0.62,
      grade: 'A',
      damage: 6,
      score: 1180,
      missionName: 'Supply Drop',
    };
    state.setScreen(SCREEN.DEBRIEF);
    cam.setMode('chase');
    // Frame the landed plane nicely for the debrief backdrop.
    camera.position.set(r.x + 40, r.y + 22, r.z + 70);
    camera.lookAt(r.x, r.y + 4, r.z);
  }

  // Run a few frames so the scene is fully lit and settled, then flag ready.
  let frames = 0;
  function tick() {
    updateWorld(0.016);
    if (state.screen === SCREEN.FLYING) cam.update(0.016, flight, terrain.heightAt);
    syncAircraft();
    render();
    frames += 1;
    if (frames < 5) requestAnimationFrame(tick);
    else window.__ready = true;
  }
  requestAnimationFrame(tick);
}

if (shot) stageShot(shot);
else runGame();