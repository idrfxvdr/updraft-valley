// The four missions and their rules. Each mission is picked from the title screen, sets the
// aircraft's starting state, then judges progress every step: the Ring Run against a clock, the
// Supply Drop in phases (take off, drop on the clearing, return and land), the Ridge Crossing on
// limited fuel to the far strip, and Free Flight to explore. Each carries a goal line and a score.
import * as THREE from 'three';
import { WORLD, riverX } from './terrain.js';

export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Run',
    tag: 'TIME TRIAL',
    blurb: 'Thread all 10 glowing rings along the river before the clock runs out.',
    goal: 'Fly through all 10 rings',
  },
  {
    id: 'supply',
    name: 'Supply Drop',
    tag: 'PRECISION',
    blurb: 'Take off, drop the crate on the marked clearing, then return and land.',
    goal: 'Drop the crate on the clearing',
  },
  {
    id: 'ridge',
    name: 'Ridge Crossing',
    tag: 'ENDURANCE',
    blurb: 'Cross the high pass on limited fuel and land on the far Ridge Strip.',
    goal: 'Cross the pass and land far',
  },
  {
    id: 'free',
    name: 'Free Flight',
    tag: 'EXPLORE',
    blurb: 'No clock, no cargo — just the valley. Land gently to finish.',
    goal: 'Explore the valley',
  },
];

const RING_LIMIT = 150; // seconds

export function createMission(id, world) {
  const def = MISSIONS.find((m) => m.id === id) ?? MISSIONS[3];
  const m = {
    def,
    time: 0,
    score: 0,
    complete: false,
    failed: false,
    goal: def.goal,
    phase: 0,
    ringsTaken: 0,
    crateDropped: false,
    crate: null,
    detail: '',
  };

  function nearRunway(flight, index) {
    const r = WORLD.runways[index];
    const st = flight.state;
    return Math.hypot(st.pos.x - r.x, st.pos.z - r.z) < r.len / 2 && st.onGround;
  }

  m.reset = (flight) => {
    m.time = 0;
    m.score = 0;
    m.complete = false;
    m.failed = false;
    m.phase = 0;
    m.ringsTaken = 0;
    m.crateDropped = false;
    m.detail = '';
    for (const r of world.rings) {
      r.taken = false;
      r.mesh.visible = true;
    }
    world.ringGroup.visible = def.id === 'rings';
    if (m.crate) {
      world.group.remove(m.crate);
      m.crate = null;
    }
    if (def.id === 'rings') {
      const z0 = -1650;
      const r0 = world.rings[0];
      flight.reset({ x: riverX(z0), y: r0.pos.y + 6, z: z0, heading: Math.PI, throttle: 0.8, fuel: 1 });
      flight.state.vel.set(0, 0, 42).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
      m.goal = 'Fly through all 10 rings';
    } else if (def.id === 'supply') {
      const r = WORLD.runways[0];
      flight.reset({ x: r.x, y: r.y + 1.55, z: r.z + r.len / 2 - 40, heading: 0, throttle: 0, fuel: 1, onGround: true });
      m.goal = 'Take off and climb out';
    } else if (def.id === 'ridge') {
      const r = WORLD.runways[0];
      flight.reset({ x: r.x, y: r.y + 1.55, z: r.z + r.len / 2 - 40, heading: 0, throttle: 0, fuel: 0.55, onGround: true });
      m.goal = 'Take off — cross the pass';
    } else {
      flight.reset({ x: -200, y: 260, z: 900, heading: Math.PI * 0.85, throttle: 0.72, fuel: 1 });
      flight.state.vel.set(0, 0, 40).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 0.85);
      m.goal = 'Explore the valley — land to finish';
    }
  };

  m.drop = () => {
    if (def.id !== 'supply' || m.phase !== 1 || m.crateDropped) return false;
    const st = m.flightState;
    const dc = Math.hypot(st.pos.x - WORLD.clearing.x, st.pos.z - WORLD.clearing.z);
    const above = st.pos.y - world.clearing.y;
    if (dc < WORLD.clearing.r && above < 80 && above > 5) {
      m.crateDropped = true;
      m.phase = 2;
      m.goal = 'Return to Valley Strip and land';
      // A simple crate that falls and rests on the clearing.
      const crate = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), new THREE.MeshStandardMaterial({ color: '#b5813c', roughness: 0.8 }));
      crate.position.set(st.pos.x, st.pos.y, st.pos.z);
      crate.userData.vy = 0;
      world.group.add(crate);
      m.crate = crate;
      return true;
    }
    return false;
  };

  m.update = (dt, flight) => {
    m.flightState = flight.state;
    if (m.complete || m.failed) return;
    if (def.id !== 'free') m.time += dt;

    if (m.crate && m.crate.userData.vy !== undefined) {
      m.crate.userData.vy -= 9.81 * dt;
      m.crate.position.y += m.crate.userData.vy * dt;
      const floor = world.clearing.y + 3;
      if (m.crate.position.y < floor) {
        m.crate.position.y = floor;
        m.crate.userData.vy = undefined;
      }
    }

    if (def.id === 'rings') {
      const st = flight.state;
      for (const r of world.rings) {
        if (r.taken) continue;
        if (st.pos.distanceTo(r.pos) < r.radius + 8) {
          r.taken = true;
          r.mesh.visible = false;
          m.ringsTaken += 1;
        }
      }
      m.detail = `${m.ringsTaken} / 10 rings`;
      if (m.ringsTaken >= 10) {
        m.complete = true;
        m.score = Math.round(m.ringsTaken * 120 + Math.max(0, 1400 - m.time * 12));
      } else if (m.time > RING_LIMIT) {
        m.failed = true;
        m.score = m.ringsTaken * 60;
      }
    } else if (def.id === 'supply') {
      const st = flight.state;
      if (m.phase === 0) {
        if (!st.onGround && st.airspeed > 30) {
          m.phase = 1;
          m.goal = 'Fly to the marked clearing';
        }
      } else if (m.phase === 1) {
        const dc = Math.hypot(st.pos.x - WORLD.clearing.x, st.pos.z - WORLD.clearing.z);
        m.detail = dc < 400 ? 'Clearing ahead — press Space low over it' : 'Clearing to the east';
        if (m.crateDropped) m.phase = 2;
      } else if (m.phase === 2) {
        if (nearRunway(flight, 0) && st.landed) {
          m.complete = true;
          m.score = Math.round(900 + st.fuel * 400 + (st.landingGrade === 'A' ? 300 : st.landingGrade === 'B' ? 180 : 80));
        }
      }
      if (st.fuel <= 0 && st.onGround && m.phase < 2) m.failed = true;
    } else if (def.id === 'ridge') {
      const st = flight.state;
      if (m.phase === 0) {
        const pass = new THREE.Vector3(120, 300, -40);
        if (st.pos.distanceTo(pass) < 170) {
          m.phase = 1;
          m.goal = 'Land on the Ridge Strip';
        }
        m.detail = st.fuel < 0.25 ? 'Fuel low — make the pass' : 'Climb for the pass';
      } else if (m.phase === 1) {
        if (nearRunway(flight, 1) && st.landed) {
          m.complete = true;
          m.score = Math.round(800 + st.fuel * 500 + (st.landingGrade === 'A' ? 300 : st.landingGrade === 'B' ? 180 : 80));
        }
      }
      if (st.fuel <= 0 && !m.complete) m.failed = true;
    } else {
      // free
      if (flight.state.landed) {
        m.complete = true;
        m.score = Math.round(400 + flight.state.fuel * 200);
      }
      m.detail = 'Land gently to finish';
    }
  };

  return m;
}