// The sky: a gradient dome, a low warm sun with a directional light, soft distance fog and a few
// light clouds. One coherent golden-hour palette ties the terrain, water and aircraft together.
import * as THREE from 'three';

export function createSky(scene, renderer) {
  const top = new THREE.Color('#2f5fa8');
  const mid = new THREE.Color('#8fb4e0');
  const horizon = new THREE.Color('#ffb066');
  const sunColor = new THREE.Color('#fff0c4');

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

  // Sun disc + light: low in the west for a long golden-hour glow.
  const sunDir = new THREE.Vector3(-0.62, 0.19, -0.76).normalize();
  const sun = new THREE.Mesh(new THREE.CircleGeometry(150, 24), new THREE.MeshBasicMaterial({ color: sunColor, fog: false }));
  sun.position.copy(sunDir).multiplyScalar(4200);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(420, 24), new THREE.MeshBasicMaterial({ color: '#ffcf8a', transparent: true, opacity: 0.4, fog: false, depthWrite: false }));
  glow.position.copy(sunDir).multiplyScalar(4150);
  glow.lookAt(0, 0, 0);
  scene.add(glow);

  const sunLight = new THREE.DirectionalLight('#ffcf9a', 2.5);
  sunLight.position.copy(sunDir).multiplyScalar(1000);
  scene.add(sunLight);
  const hemi = new THREE.HemisphereLight('#ffd9b4', '#3a2f22', 0.7);
  scene.add(hemi);
  const amb = new THREE.AmbientLight('#ffe6c4', 0.32);
  scene.add(amb);

  // Soft fog toward the warm horizon colour.
  scene.fog = new THREE.Fog(horizon.clone().lerp(mid, 0.22), 1000, 4400);

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