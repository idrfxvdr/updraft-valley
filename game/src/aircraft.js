// The aircraft: a small high-wing propeller bush plane built from three.js primitives — fuselage,
// high wing, tail, lift struts, a spinning propeller, fixed tricycle-ish gear with a tail wheel and
// a red-and-cream livery. The group's nose points down local -Z, matching the flight model.
import * as THREE from 'three';

export function createAircraft() {
  const group = new THREE.Group();
  group.name = 'aircraft';

  const livery = new THREE.MeshStandardMaterial({ color: '#c8392b', metalness: 0.25, roughness: 0.55 });
  const cream = new THREE.MeshStandardMaterial({ color: '#efe6cf', metalness: 0.15, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2e33', metalness: 0.4, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1c2a38', metalness: 0.6, roughness: 0.15, transparent: true, opacity: 0.82 });
  const metal = new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.7, roughness: 0.35 });

  // Fuselage: a tapered body along Z (nose at -Z).
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 6.4, 12), livery);
  fuse.rotation.x = Math.PI / 2;
  fuse.position.set(0, 0, 0.2);
  group.add(fuse);
  // Nose cowling.
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 1.2, 12), cream);
  cowl.rotation.x = Math.PI / 2;
  cowl.position.set(0, 0.05, -3.2);
  group.add(cowl);
  // Spinner.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 12), metal);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.set(0, 0.05, -4.0);
  group.add(spinner);

  // Propeller (spins around Z).
  const prop = new THREE.Group();
  prop.name = 'propeller';
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.0, 0.08), dark);
  prop.add(blade);
  const blade2 = blade.clone();
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade2);
  prop.position.set(0, 0.05, -4.05);
  group.add(prop);

  // High wing across X, sitting above the cabin.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.28, 2.1), cream);
  wing.position.set(0, 1.35, 0.1);
  group.add(wing);
  // Wing struts (V from lower fuselage to mid-wing).
  for (const sx of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6), metal);
    strut.position.set(sx * 2.4, 0.2, 0.2);
    strut.rotation.z = sx * 0.9;
    strut.rotation.x = 0.12;
    group.add(strut);
  }
  // Wing tip caps.
  for (const sx of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 2.1), livery);
    tip.position.set(sx * 6.75, 1.35, 0.1);
    group.add(tip);
  }

  // Cabin glass.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.8), glass);
  cabin.position.set(0, 0.75, -1.2);
  group.add(cabin);

  // Tail: horizontal stabiliser + vertical fin.
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.18, 1.1), cream);
  hstab.position.set(0, 0.35, 3.3);
  group.add(hstab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.9, 1.3), livery);
  fin.position.set(0, 1.1, 3.5);
  group.add(fin);

  // Landing gear: two main wheels + tail wheel.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 6), metal);
    leg.position.set(sx * 1.3, -0.75, -0.4);
    leg.rotation.z = sx * 0.25;
    group.add(leg);
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(sx * 1.55, -1.35, -0.4);
    group.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -1.15, 3.2);
  group.add(tailWheel);

  group.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });

  let propClock = 0;
  return {
    group,
    propeller: prop,
    /** Spin the propeller and wobble it a touch at high throttle. */
    update(dt, throttle) {
      propClock += dt;
      prop.rotation.z += dt * (8 + throttle * 46);
      prop.rotation.x = Math.sin(propClock * 11) * 0.02 * throttle;
    },
  };
}