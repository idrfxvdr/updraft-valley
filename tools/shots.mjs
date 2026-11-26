// Screenshot and smoke-test runner for Updraft Valley (Node 22, Playwright from the make.fun
// tools, system Chromium). It serves game/ with a tiny static server, then for each shot in
// screenshots/plan.json opens ?shot=<name>&seed=1 at 1280x720, waits for window.__ready and
// writes a JPEG, lowering quality step by step until it is within 256 KiB. Finally it smoke-tests
// the real game: no console errors, the title loads, every mission starts, and three seconds of
// simulated flight with throttle input changes altitude/speed.
import { createServer } from 'node:http';
import { createReadStream, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/root/makefun/tools/node_modules/playwright/index.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '..', 'game');
const shotsDir = resolve(here, '..', 'screenshots');
mkdirSync(shotsDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  let size;
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error('dir');
    size = st.size;
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'content-length': size, 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
});

const PORT = 8137;
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const base = `http://127.0.0.1:${PORT}/`;

const plan = JSON.parse(readFileSync(join(here, 'plan.json'), 'utf8'));

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

// ---- screenshots ---------------------------------------------------------
for (const shot of plan) {
  await page.goto(`${base}?shot=${shot.name}&seed=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 20000 });
  const outPath = join(shotsDir, shot.file);
  let quality = 0.92;
  let bytes = 0;
  for (;;) {
    await page.screenshot({ path: outPath, type: 'jpeg', quality: Math.round(quality * 100) });
    bytes = statSync(outPath).size;
    if (bytes <= 262144 || quality <= 0.3) break;
    quality -= 0.08;
  }
  let airKn = null;
  if (shot.name === 'cover' || shot.name === 'approach' || shot.name === 'cockpit') {
    airKn = await page.evaluate(() => window.__game.flight.state.airspeed * 1.94384);
    if (!(airKn > 40)) errors.push(`shot ${shot.name}: airspeed ${airKn?.toFixed(1)} kn not > 40`);
  }
  console.log(`${shot.file}: ${bytes} bytes (quality ${Math.round(quality * 100)})${airKn !== null ? `, airspeed ${airKn.toFixed(0)} kn` : ''}`);
}

// ---- smoke test ----------------------------------------------------------
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction('window.__game && window.__game.state', { timeout: 20000 });

const titleOk = await page.evaluate(() => window.__game.state.screen === 'title');
console.log(`title screen loads: ${titleOk}`);

const missionResults = [];
for (let i = 0; i < 4; i += 1) {
  const ok = await page.evaluate((idx) => {
    window.__game.startMission(idx);
    window.__game.beginFlight();
    return window.__game.state.screen === 'flying' && !!window.__game.mission();
  }, i);
  missionResults.push(ok);
  console.log(`mission ${i + 1} starts: ${ok}`);
}

const flight = await page.evaluate(() => {
  const g = window.__game;
  g.startMission(3);
  g.beginFlight();
  const a = { alt: g.flight.state.pos.y, speed: g.flight.state.airspeed, fuel: g.flight.state.fuel };
  const b = g.stepFor(3, 1.0); // full throttle for 3 s
  const c = g.stepFor(3, 0.1); // idle for 3 s
  return { a, b, c };
});
const changed = flight.b.alt !== flight.a.alt || flight.b.speed !== flight.a.speed || flight.c.speed !== flight.b.speed;
console.log(`3 s flight: alt ${flight.a.alt.toFixed(1)} -> ${flight.b.alt.toFixed(1)} -> ${flight.c.alt.toFixed(1)}, speed ${flight.a.speed.toFixed(1)} -> ${flight.b.speed.toFixed(1)} -> ${flight.c.speed.toFixed(1)}`);
console.log(`throttle changes altitude/speed: ${changed}`);
console.log(`problems (console errors + shot checks): ${errors.length}`);
for (const e of errors) console.log(`  ${e}`);

await browser.close();
server.close();

const ok = titleOk && missionResults.every(Boolean) && changed && errors.length === 0;
console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);