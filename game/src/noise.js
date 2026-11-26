// Seeded value noise for the valley: a small deterministic hash, smooth 2D value noise and a
// fractal sum (fbm). The same seed always builds the same terrain, so a screenshot staged with
// ?seed=1 is reproducible and the ground the flight model stands on never changes under it.

/** Build a noise source from a 32-bit seed. */
export function makeNoise(seed) {
  let s = (seed >>> 0) || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const p = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) base[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < 512; i += 1) p[i] = base[i & 255];

  // Hash a lattice point to a value in [0,1).
  const hash = (x, y) => p[(p[x & 255] + (y & 255)) & 255] / 255;

  /** Smooth 2D value noise in [0,1). */
  function vnoise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  /** Fractal sum of value noise in [0,1]. */
  function fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i += 1) {
      sum += amp * vnoise(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  return { rand, vnoise, fbm };
}