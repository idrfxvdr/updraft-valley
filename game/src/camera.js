// Two cameras: a smooth chase that trails behind and above the plane and never fights the pilot,
// and a cockpit view from the pilot's seat looking forward over the nose. C toggles; the chase
// camera is clamped above the terrain so it never dips into a ridge.
import * as THREE from 'three';

const FWD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);

export function createCamera(camera) {
  let mode = 'chase';
  const smoothPos = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const cockpitQ = new THREE.Quaternion();
  let initialised = false;

  function toggle() {
    mode = mode === 'chase' ? 'cockpit' : 'chase';
    initialised = false;
    return mode;
  }

  function update(dt, flight, heightAt) {
    const st = flight.state;
    fwd.copy(FWD).applyQuaternion(st.quat);
    up.copy(UP).applyQuaternion(st.quat);
    q.copy(st.quat);

    if (mode === 'chase') {
      // Trail well behind (about 3.4 wingspans) and a little above, so the whole aircraft sits in
      // the lower-middle third and the ring, valley and runway ahead read clearly.
      const span = 13.5;
      const back = span * 3.4 + Math.min(6, st.airspeed * 0.06);
      offset.set(0, 6.2, back).applyQuaternion(q);
      desired.copy(st.pos).add(offset);
      const groundY = heightAt(desired.x, desired.z) + 3.0;
      if (desired.y < groundY) desired.y = groundY;
      if (!initialised) {
        smoothPos.copy(desired);
        initialised = true;
      } else {
        smoothPos.lerp(desired, 1 - Math.exp(-dt * 3.6));
      }
      camera.position.copy(smoothPos);
      look.copy(st.pos).addScaledVector(fwd, 30).addScaledVector(up, 4.0);
      camera.up.copy(UP);
      camera.lookAt(look);
    } else {
      // Cockpit: at the pilot's eye, looking forward over the nose.
      offset.set(0, 1.2, -2.6).applyQuaternion(q);
      camera.position.copy(st.pos).add(offset);
      cockpitQ.setFromEuler(new THREE.Euler(-0.04, 0, 0));
      camera.quaternion.copy(q).multiply(cockpitQ);
    }
  }

  return {
    update,
    toggle,
    get mode() {
      return mode;
    },
    setMode(m) {
      mode = m;
      initialised = false;
    },
  };
}