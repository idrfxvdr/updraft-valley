// The flight model: a force-based bush plane. Thrust along the nose, lift from airspeed and angle
// of attack, quadratic drag, gravity, and a stall below ~55 kn. Control authority grows with
// airspeed, the ground answers with a gentle-landing or crash test (vertical speed, bank, pitch),
// fuel burns with throttle and damage ends a sortie. One fixed step is one call to step().
import * as THREE from 'three';

const RHO = 1.225;
const MASS = 1000;
const WING = 16;
const G = 9.81;
const MAX_THRUST = 2600;
const STALL_SPEED = 28.3; // ~55 kn
const FUEL_BURN = 0.0075; // per second at full throttle (fraction of a full tank)
const GEAR_DROP = 1.55; // CG height above the wheels

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const FWD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);

export function createFlight() {
  const state = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    throttle: 0.65,
    fuel: 1,
    damage: 0,
    flaps: 0, // 0..1
    brakes: false,
    airspeed: 0, // m/s
    aoa: 0,
    stall: false,
    onGround: true,
    verticalSpeed: 0,
    heading: 0, // deg
    crashed: false,
    landed: false, // set true for one step on a touchdown
    landingGrade: null,
    gLoad: 1,
  };

  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3();
  const right = new THREE.Vector3();
  const vBody = new THREE.Vector3();
  const qInv = new THREE.Quaternion();
  const accel = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const dq = new THREE.Quaternion();
  const euler = new THREE.Euler();

  function reset(opts = {}) {
    state.pos.set(opts.x ?? 0, opts.y ?? 200, opts.z ?? 0);
    state.vel.set(0, 0, 0);
    state.quat.identity();
    if (opts.heading) state.quat.setFromAxisAngle(UP, opts.heading);
    if (opts.pitch) state.quat.multiply(new THREE.Quaternion().setFromAxisAngle(RIGHT, opts.pitch));
    state.throttle = opts.throttle ?? 0.65;
    state.fuel = opts.fuel ?? 1;
    state.damage = opts.damage ?? 0;
    state.flaps = opts.flaps ?? 0;
    state.brakes = false;
    state.airspeed = 0;
    state.aoa = 0;
    state.stall = false;
    state.onGround = opts.onGround ?? false;
    state.verticalSpeed = 0;
    state.crashed = false;
    state.landed = false;
    state.landingGrade = null;
    state.gLoad = 1;
  }

  /** One fixed step. `controls` = { pitch, roll, yaw, dThrottle, flaps, brakes } (axes -1..1). */
  function step(dt, controls) {
    state.landed = false;
    fwd.copy(FWD).applyQuaternion(state.quat);
    up.copy(UP).applyQuaternion(state.quat);
    right.copy(RIGHT).applyQuaternion(state.quat);

    const airspeed = state.vel.length();
    state.airspeed = airspeed;

    // Throttle.
    state.throttle = clamp(state.throttle + (controls.dThrottle || 0) * dt * 0.6, 0, 1);
    if (state.fuel <= 0) state.throttle = 0;
    state.flaps = clamp(state.flaps + (controls.flaps || 0) * dt * 1.5, 0, 1);
    state.brakes = !!controls.brakes;

    // Body-frame velocity -> angle of attack.
    qInv.copy(state.quat).invert();
    vBody.copy(state.vel).applyQuaternion(qInv);
    const forwardSpeed = -vBody.z;
    state.aoa = Math.atan2(-vBody.y, Math.max(0.5, forwardSpeed));

    // Control authority scales with airspeed.
    const authority = clamp(airspeed / 42, 0.18, 1.5);
    const pitchRate = (controls.pitch || 0) * 1.15 * authority;
    const rollRate = (controls.roll || 0) * 2.4 * authority;
    const yawRate = (controls.yaw || 0) * 0.7 * authority;
    if (state.onGround) {
      // On the ground the plane only steers and pitches a little.
      dq.setFromAxisAngle(UP, yawRate * dt * 0.9);
      state.quat.multiply(dq);
    } else {
      euler.set(pitchRate * dt, yawRate * dt, rollRate * dt, 'YXZ');
      dq.setFromEuler(euler);
      state.quat.multiply(dq).normalize();
    }

    // Aerodynamic forces (recompute axes after rotation).
    fwd.copy(FWD).applyQuaternion(state.quat);
    up.copy(UP).applyQuaternion(state.quat);
    right.copy(RIGHT).applyQuaternion(state.quat);
    const qS = 0.5 * RHO * airspeed * airspeed * WING;

    // Lift coefficient with a post-stall drop.
    const aStall = 0.3;
    let CL = 0.25 + 4.8 * state.aoa + state.flaps * 0.55;
    if (state.aoa > aStall) CL = Math.max(0.35, 1.7 - (state.aoa - aStall) * 3.2);
    CL = clamp(CL, -0.6, 1.75);
    const CD = 0.045 + 0.05 * CL * CL + state.flaps * 0.06 + (state.brakes ? 0.1 : 0);

    const lift = qS * CL;
    const drag = qS * CD;

    // Stall: slow flight, below about 55 kn.
    state.stall = airspeed < STALL_SPEED && !state.onGround;

    accel.set(0, -G, 0); // gravity (m/s^2)
    tmp.copy(fwd).multiplyScalar((state.throttle * MAX_THRUST) / MASS);
    accel.add(tmp);
    tmp.copy(up).multiplyScalar(lift / MASS);
    accel.add(tmp);
    if (airspeed > 0.01) {
      tmp.copy(state.vel).multiplyScalar(-drag / MASS / airspeed);
      accel.add(tmp);
    }
    // Sideslip damping keeps turns coordinated.
    tmp.copy(right).multiplyScalar((-vBody.x * 0.5 * RHO * airspeed * WING * 0.5) / MASS);
    accel.add(tmp);

    if (state.stall) {
      // Nose drops and a wing wobbles at the stall.
      accel.add(tmp.copy(fwd).multiplyScalar(-3.0));
    }

    state.vel.addScaledVector(accel, dt);
    state.pos.addScaledVector(state.vel, dt);

    // Fuel.
    if (state.throttle > 0 && state.fuel > 0) {
      state.fuel = Math.max(0, state.fuel - FUEL_BURN * state.throttle * dt * (1 + state.aoa * 0.4));
    }

    state.verticalSpeed = state.vel.y;
    state.gLoad = clamp(lift / (MASS * G), -2, 6);

    // Heading from forward vector.
    state.heading = (Math.atan2(fwd.x, -fwd.z) * 180) / Math.PI;
    if (state.heading < 0) state.heading += 360;

    return state;
  }

  /**
   * Ground contact and landing/crash test. `groundY` is terrain height at the plane; returns an
   * event string: 'landed', 'crashed', 'rolling' or null.
   */
  function groundContact(groundY, onRunway) {
    const wheels = state.pos.y - GEAR_DROP;
    if (wheels > groundY + 0.05) {
      state.onGround = false;
      return null;
    }
    // Touchdown.
    const bankAngle = Math.abs(Math.atan2(right.y, up.y));
    const pitchAngle = Math.asin(clamp(fwd.y, -1, 1));
    const vs = state.vel.y;
    const wasAir = !state.onGround;
    state.onGround = true;
    state.pos.y = groundY + GEAR_DROP;
    state.vel.y = 0;

    if (wasAir) {
      const hard = vs < -3.6 || bankAngle > 0.32 || pitchAngle < -0.22 || !onRunway && state.airspeed > 62;
      if (hard || state.damage >= 100) {
        state.damage = 100;
        state.crashed = true;
        state.landingGrade = 'F';
        return 'crashed';
      }
      // Grade the landing.
      const sev = -vs + bankAngle * 6 + Math.abs(pitchAngle) * 4;
      state.landingGrade = sev < 1.4 ? 'A' : sev < 2.4 ? 'B' : sev < 3.4 ? 'C' : sev < 4.6 ? 'D' : 'F';
      state.damage = Math.min(100, state.damage + Math.max(0, sev - 1.2) * 4);
      state.landed = true;
      // Touchdown scrub.
      state.vel.x *= 0.9;
      state.vel.z *= 0.9;
      return 'landed';
    }
    // Rolling on the ground: friction, brakes, keep wings level.
    const speed = Math.hypot(state.vel.x, state.vel.z);
    if (speed > 0.05) {
      const fr = state.brakes ? 6.5 : 1.1;
      const drop = Math.min(speed, fr * dt);
      const nx = state.vel.x / speed;
      const nz = state.vel.z / speed;
      state.vel.x -= nx * drop;
      state.vel.z -= nz * drop;
    }
    // Level the wings and settle pitch while rolling.
    const yaw = Math.atan2(fwd.x, -fwd.z);
    const level = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
    state.quat.slerp(level, Math.min(1, dt * 3));
    return 'rolling';
  }

  return { state, reset, step, groundContact, constants: { STALL_SPEED, GEAR_DROP } };
}