// The sky: a gradient dome, a low warm sun with a directional light, soft distance fog and a few
// light clouds. One coherent golden-hour palette ties the terrain, water and aircraft together.
import * as THREE from 'three';

export function createSky(scene, renderer) {
  const top = new THREE.Color('#3f6fb5');
  const mid = new THREE.Color('#9fc0e8');
  const horizon = new THREE.Color('#ffd7a0');
  const sunColor = new THREE.Color('#fff3d0');

  // Gradient dome via vertex colours on a big back-side sphere.
  const domeGeo = new THREE.SphereGeometry(5200, 32, 20);
  const colors = new Float32Array(domeGeo.attributes.position.count * 3);
  const pos = domeGeo.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i) / 5200; // -1..1
    if (y > 0.25) c.copy(mid).lerp(top, (y - 0.25) / 0.75);
    else c.copy(horizon).lerp(mid, Math.max(0, (y + 0.05) / 0.3));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  domeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.name = 'sky';
  scene.add(dome);

  // Sun disc + light.
  const sunDir = new THREE.Vector3(-0.55, 0.34, -0.76).normalize();
  const sun = new THREE.Mesh(new THREE.CircleGeometry(140, 24), new THREE.MeshBasicMaterial({ color: sunColor, fog: false }));
  sun.position.copy(sunDir).multiplyScalar(4200);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(320, 24), new THREE.MeshBasicMaterial({ color: '#ffdca0', transparent: true, opacity: 0.35, fog: false, depthWrite: false }));
  glow.position.copy(sunDir).multiplyScalar(4150);
  glow.lookAt(0, 0, 0);
  scene.add(glow);

  const sunLight = new THREE.DirectionalLight('#fff0d2', 2.1);
  sunLight.position.copy(sunDir).multiplyScalar(1000);
  scene.add(sunLight);
  const hemi = new THREE.HemisphereLight('#cfe2ff', '#4a5a3a', 0.75);
  scene.add(hemi);
  const amb = new THREE.AmbientLight('#ffffff', 0.25);
  scene.add(amb);

  // Soft fog toward the horizon colour.
  scene.fog = new THREE.Fog(horizon.clone().lerp(mid, 0.35), 900, 4200);

  // A few flat, soft clouds.
  const clouds = new THREE.Group();
  clouds.name = 'clouds';
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, fog: false, depthWrite: false });
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2 + 0.4;
    const rad = 1600 + (i % 5) * 420;
    const cl = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), cloudMat);
    cl.position.set(Math.cos(a) * rad, 700 + (i % 4) * 130, Math.sin(a) * rad);
    cl.scale.set(220 + (i % 3) * 120, 42 + (i % 2) * 26, 160 + (i % 4) * 70);
    clouds.add(cl);
  }
  scene.add(clouds);

  renderer.setClearColor(horizon, 1);

  return {
    sunDir,
    sunLight,
    update(dt) {
      // Clouds drift very slowly so the sky feels alive but stays calm.
      clouds.rotation.y += dt * 0.004;
    },
  };
}