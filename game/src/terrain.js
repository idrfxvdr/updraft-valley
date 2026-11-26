// The valley itself: a seeded height field coloured by height and slope, a river and lake sunk
// below a single water plane, instanced pines, a small town, two marked airstrips with windsocks,
// the glowing rings of the Ring Run and the marked supply clearing. It also exposes heightAt(x,z),
// the one function the flight model and the cameras ask "how high is the ground here".
import * as THREE from 'three';

export const WORLD = {
  size: 4200,
  half: 2100,
  water: 0,
  lake: { x: 260, z: -160, r: 300 },
  town: { x: -300, z: 360 },
  clearing: { x: 470, z: 120, r: 48 },
  runways: [
    { x: -520, z: 780, hdg: 0, len: 430, wid: 36, y: 9, name: 'Valley Strip' },
    { x: 700, z: -840, hdg: 90, len: 390, wid: 34, y: 12, name: 'Ridge Strip' },
  ],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
const lerp = (a, b, t) => a + (b - a) * t;

/** The river's centreline x at a given z: a slow meander down the valley. */
export function riverX(z) {
  return 120 * Math.sin(z * 0.0016) + 46 * Math.sin(z * 0.0041 + 1.3);
}

/** Build the terrain and every prop that stands on it. Returns handles the game and cameras use. */
export function createTerrain(scene, noise) {
  const group = new THREE.Group();
  group.name = 'terrain';
  scene.add(group);

  // ---- height field ------------------------------------------------------
  function rawHeight(x, z) {
    const edge = Math.max(Math.abs(x), Math.abs(z)) / WORLD.half;
    let h = smooth((edge - 0.5) / 0.5);
    h = h * h * 470;
    const n = noise.fbm(x * 0.0015 + 10, z * 0.0015 + 20, 4);
    h += (n - 0.5) * 80 * (0.35 + edge * 1.3);
    h += 7;
    // River channel.
    const dr = Math.abs(x - riverX(z));
    if (dr < 95) h = lerp(h, -4.5, smooth(1 - dr / 95) * 0.92);
    // Lake basin.
    const dl = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z);
    if (dl < WORLD.lake.r) h = lerp(h, -5.5, smooth(1 - dl / WORLD.lake.r));
    return h;
  }

  // Flatten pads for the town, the clearing and each runway so props sit level.
  function heightAt(x, z) {
    let h = rawHeight(x, z);
    const dt = Math.hypot(x - WORLD.town.x, z - WORLD.town.z);
    if (dt < 190) h = lerp(h, 10, smooth(1 - dt / 190));
    const dc = Math.hypot(x - WORLD.clearing.x, z - WORLD.clearing.z);
    if (dc < WORLD.clearing.r + 26) h = lerp(h, 11, smooth(1 - (dc - WORLD.clearing.r) / 26));
    for (const r of WORLD.runways) {
      const dx = x - r.x;
      const dz = z - r.z;
      const c = Math.cos(r.hdg);
      const s = Math.sin(r.hdg);
      const lx = dx * c + dz * s;
      const lz = -dx * s + dz * c;
      const padX = r.len / 2 + 46;
      const padZ = r.wid / 2 + 46;
      const ox = Math.abs(lx) - padX;
      const oz = Math.abs(lz) - padZ;
      const d = Math.max(ox, oz);
      if (d < 0) h = r.y;
      else if (d < 40) h = lerp(r.y, h, smooth(d / 40));
    }
    return h;
  }

  // ---- terrain mesh ------------------------------------------------------
  const SEG = 200;
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color('#4f7a34');
  const cGrassDry = new THREE.Color('#7f8a45');
  const cRock = new THREE.Color('#6d6a63');
  const cSnow = new THREE.Color('#eef2f5');
  const cSand = new THREE.Color('#c9b98a');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    // slope from neighbours
    const e = 6;
    const hx = heightAt(x + e, z) - heightAt(x - e, z);
    const hz = heightAt(x, z + e) - heightAt(x, z - e);
    const slope = Math.min(1, Math.hypot(hx, hz) / (2 * e) * 1.4);
    if (y < 2.5) tmp.copy(cSand);
    else if (y > 300 + slope * 60) tmp.copy(cSnow);
    else if (slope > 0.55 || y > 190) tmp.copy(cRock).lerp(cSnow, clamp01((y - 260) / 120));
    else tmp.copy(cGrass).lerp(cGrassDry, noise.vnoise(x * 0.01, z * 0.01) * 0.6);
    tmp.multiplyScalar(0.9 + noise.vnoise(x * 0.05, z * 0.05) * 0.2);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const ground = new THREE.Mesh(geo, mat);
  ground.name = 'ground';
  group.add(ground);

  // ---- water (one plane at water level fills river and lake) -------------
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size, WORLD.size),
    new THREE.MeshPhongMaterial({ color: '#2f6f9e', transparent: true, opacity: 0.86, shininess: 90, specular: '#bfe3ff' }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WORLD.water;
  water.name = 'water';
  group.add(water);

  // ---- pines (instanced) -------------------------------------------------
  const pineGeo = new THREE.ConeGeometry(7, 26, 7);
  pineGeo.translate(0, 13, 0);
  const pineMat = new THREE.MeshLambertMaterial({ color: '#2f5a2c' });
  const pineCount = 900;
  const pines = new THREE.InstancedMesh(pineGeo, pineMat, pineCount);
  pines.name = 'pines';
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pv = new THREE.Vector3();
  const pinePositions = [];
  let placed = 0;
  let guard = 0;
  while (placed < pineCount && guard < pineCount * 40) {
    guard += 1;
    const x = (noise.rand() - 0.5) * WORLD.size * 0.96;
    const z = (noise.rand() - 0.5) * WORLD.size * 0.96;
    const y = heightAt(x, z);
    if (y < 9 || y > 250) continue;
    const e = 8;
    const slope = Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    if (slope > 0.5) continue;
    if (Math.hypot(x - WORLD.town.x, z - WORLD.town.z) < 210) continue;
    if (Math.hypot(x - WORLD.clearing.x, z - WORLD.clearing.z) < WORLD.clearing.r + 40) continue;
    let nearRunway = false;
    for (const r of WORLD.runways) if (Math.hypot(x - r.x, z - r.z) < r.len * 0.6) nearRunway = true;
    if (nearRunway) continue;
    const s = 0.7 + noise.rand() * 0.9;
    pv.set(x, y - 1, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), noise.rand() * Math.PI * 2);
    sc.set(s, s * (0.85 + noise.rand() * 0.5), s);
    m4.compose(pv, q, sc);
    pines.setMatrixAt(placed, m4);
    pinePositions.push(x, z, y);
    placed += 1;
  }
  pines.count = placed;
  pines.instanceMatrix.needsUpdate = true;
  group.add(pines);

  // ---- town --------------------------------------------------------------
  const town = new THREE.Group();
  town.name = 'town';
  const wallMats = ['#d9cbb0', '#c8b79a', '#e0d6c2', '#b9a98d'].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const roofMat = new THREE.MeshLambertMaterial({ color: '#8a4a3a' });
  for (let i = 0; i < 26; i += 1) {
    const ang = noise.rand() * Math.PI * 2;
    const rad = 30 + noise.rand() * 140;
    const x = WORLD.town.x + Math.cos(ang) * rad;
    const z = WORLD.town.z + Math.sin(ang) * rad;
    const y = heightAt(x, z);
    const w = 10 + noise.rand() * 8;
    const d = 10 + noise.rand() * 8;
    const h = 7 + noise.rand() * 6;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMats[i % wallMats.length]);
    body.position.set(x, y + h / 2, z);
    town.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 5, 4), roofMat);
    roof.position.set(x, y + h + 2.5, z);
    roof.rotation.y = Math.PI / 4;
    town.add(roof);
  }
  group.add(town);

  // ---- runways -----------------------------------------------------------
  const runwayHandles = [];
  const asphalt = new THREE.MeshLambertMaterial({ color: '#3a3d42' });
  const paint = new THREE.MeshBasicMaterial({ color: '#e8e8e0' });
  for (const r of WORLD.runways) {
    const rg = new THREE.Group();
    rg.name = `runway-${r.name}`;
    rg.position.set(r.x, r.y + 0.08, r.z);
    rg.rotation.y = r.hdg;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(r.wid, 0.3, r.len), asphalt);
    rg.add(strip);
    // centreline dashes
    for (let z = -r.len / 2 + 20; z < r.len / 2 - 10; z += 40) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 18), paint);
      dash.position.set(0, 0.2, z);
      rg.add(dash);
    }
    // threshold bars at each end
    for (const end of [-1, 1]) {
      for (let k = -3; k <= 3; k += 1) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 14), paint);
        bar.position.set(k * 4.2, 0.2, end * (r.len / 2 - 16));
        rg.add(bar);
      }
    }
    group.add(rg);
    // windsock
    const ws = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 12, 6), new THREE.MeshLambertMaterial({ color: '#dddddd' }));
    pole.position.y = 6;
    ws.add(pole);
    const sock = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 8, 1, true), new THREE.MeshLambertMaterial({ color: '#e8622a', side: THREE.DoubleSide }));
    sock.rotation.z = Math.PI / 2;
    sock.position.set(3.4, 11.4, 0);
    ws.add(sock);
    const wx = r.x + Math.cos(r.hdg) * (r.wid / 2 + 14);
    const wz = r.z - Math.sin(r.hdg) * (r.wid / 2 + 14);
    ws.position.set(wx, heightAt(wx, wz), wz);
    ws.name = 'windsock';
    group.add(ws);
    runwayHandles.push({ def: r, group: rg, sock });
  }

  // ---- supply clearing marker -------------------------------------------
  const clearing = new THREE.Group();
  clearing.name = 'clearing';
  const cy = heightAt(WORLD.clearing.x, WORLD.clearing.z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(WORLD.clearing.r - 6, WORLD.clearing.r, 40), new THREE.MeshBasicMaterial({ color: '#ffd24a', side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(WORLD.clearing.x, cy + 0.4, WORLD.clearing.z);
  clearing.add(ring);
  const crossMat = new THREE.MeshBasicMaterial({ color: '#ffd24a' });
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(WORLD.clearing.r * 1.1, 0.4, 4), crossMat);
  c1.position.set(WORLD.clearing.x, cy + 0.4, WORLD.clearing.z);
  c1.rotation.y = Math.PI / 4;
  clearing.add(c1);
  const c2 = c1.clone();
  c2.rotation.y = -Math.PI / 4;
  clearing.add(c2);
  group.add(clearing);

  // ---- rings for the Ring Run -------------------------------------------
  const ringMat = new THREE.MeshStandardMaterial({ color: '#38e0ff', emissive: '#1fb6d8', emissiveIntensity: 1.4, metalness: 0.2, roughness: 0.4 });
  const rings = [];
  const ringGroup = new THREE.Group();
  ringGroup.name = 'rings';
  const RING_N = 10;
  for (let i = 0; i < RING_N; i += 1) {
    const t = i / (RING_N - 1);
    const z = lerp(-1500, 1500, t);
    const x = riverX(z) + Math.sin(i * 1.7) * 40;
    const y = Math.max(heightAt(x, z) + 55, 70) + Math.sin(i * 0.9) * 18;
    const torus = new THREE.Mesh(new THREE.TorusGeometry(24, 2.6, 10, 28), ringMat);
    torus.position.set(x, y, z);
    torus.lookAt(x, y, z + 1);
    ringGroup.add(torus);
    rings.push({ mesh: torus, pos: new THREE.Vector3(x, y, z), radius: 24, taken: false });
  }
  group.add(ringGroup);

  return {
    group,
    heightAt,
    water,
    ground,
    pines,
    pinePositions,
    town,
    runways: runwayHandles,
    clearing: { ...WORLD.clearing, y: cy, group: clearing, ring },
    rings,
    ringGroup,
    ringMat,
    update(dt) {
      // Windsocks swing gently; rings pulse.
      const t = performance.now() / 1000;
      for (const r of runwayHandles) r.sock.rotation.y = Math.sin(t * 0.8) * 0.25;
      ringMat.emissiveIntensity = 1.1 + Math.sin(t * 3) * 0.5;
    },
  };
}