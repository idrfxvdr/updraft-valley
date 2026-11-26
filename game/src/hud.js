// The heads-up display, drawn crisp on a 2D canvas overlay: a heading compass tape with degrees,
// airspeed (kn), altitude (ft) and vertical speed, throttle / fuel / damage bars, a mini map with
// the next goal, a stall warning and a status line. Lit like real instruments (dark glass, amber
// and cyan), and sized to stay readable when the screenshot is shrunk.
import { WORLD, riverX } from './terrain.js';

const KN = 1.94384; // m/s -> knots
const FT = 3.28084; // m -> feet

function panel(ctx, x, y, w, h, r = 8) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,16,24,0.58)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,200,230,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function glowText(ctx, text, x, y, color, font, align = 'left') {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function bar(ctx, x, y, w, h, frac, color, label, value) {
  panel(ctx, x, y, w, h, 6);
  const pad = 4;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x + pad, y + pad + 12, w - pad * 2, h - pad * 2 - 12);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillRect(x + pad, y + pad + 12, (w - pad * 2) * Math.max(0, Math.min(1, frac)), h - pad * 2 - 12);
  ctx.shadowBlur = 0;
  glowText(ctx, label, x + pad + 2, y + 14, '#bfe3ef', '600 13px ui-monospace, monospace');
  glowText(ctx, value, x + w - pad - 2, y + 14, '#eaf6ff', '600 13px ui-monospace, monospace', 'right');
}

function drawHeadingTape(ctx, W, heading) {
  const cx = W / 2;
  const y = 26;
  const w = 460;
  const h = 34;
  panel(ctx, cx - w / 2, y - 18, w, h + 8, 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2 + 4, y - 16, w - 8, h + 4);
  ctx.clip();
  const pxPerDeg = 3.2;
  const start = Math.floor((heading - 80) / 5) * 5;
  for (let d = start; d <= heading + 80; d += 5) {
    const x = cx + (d - heading) * pxPerDeg;
    const norm = ((d % 360) + 360) % 360;
    const major = norm % 30 === 0;
    ctx.strokeStyle = major ? 'rgba(220,240,250,0.9)' : 'rgba(180,210,225,0.5)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h - (major ? 12 : 6));
    ctx.lineTo(x, y + h);
    ctx.stroke();
    if (major) {
      ctx.font = '600 14px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#cfe6f2';
      ctx.fillText(String(norm).padStart(3, '0'), x, y + 14);
    }
  }
  ctx.restore();
  // Centre caret + numeric heading.
  ctx.fillStyle = '#ffcf5a';
  ctx.beginPath();
  ctx.moveTo(cx, y - 16);
  ctx.lineTo(cx - 7, y - 26);
  ctx.lineTo(cx + 7, y - 26);
  ctx.closePath();
  ctx.fill();
  glowText(ctx, `${Math.round(heading) % 360}`.padStart(3, '0') + '°', cx, y - 30, '#ffcf5a', '700 20px ui-monospace, monospace', 'center');
}

function drawMinimap(ctx, x, y, size, view) {
  panel(ctx, x - 6, y - 6, size + 12, size + 12, 8);
  const pad = 6;
  const s = size - pad * 2;
  const toMap = (wx, wz) => [x + pad + ((wx + WORLD.half) / (WORLD.half * 2)) * s, y + pad + ((wz + WORLD.half) / (WORLD.half * 2)) * s];
  // water hint (river polyline)
  ctx.strokeStyle = 'rgba(70,150,200,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let z = -WORLD.half; z <= WORLD.half; z += 120) {
    const [mx, my] = toMap(riverX(z), z);
    if (z === -WORLD.half) ctx.moveTo(mx, my);
    else ctx.lineTo(mx, my);
  }
  ctx.stroke();
  // lake
  const [lx, ly] = toMap(WORLD.lake.x, WORLD.lake.z);
  ctx.fillStyle = 'rgba(70,150,200,0.8)';
  ctx.beginPath();
  ctx.arc(lx, ly, (WORLD.lake.r / (WORLD.half * 2)) * s, 0, Math.PI * 2);
  ctx.fill();
  // runways
  ctx.fillStyle = '#dfe8ee';
  for (const r of WORLD.runways) {
    const [rx, ry] = toMap(r.x, r.z);
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(r.hdg);
    ctx.fillRect(-2, -r.len / 2 / (WORLD.half * 2) * s, 4, r.len / (WORLD.half * 2) * s);
    ctx.restore();
  }
  // rings
  if (view.mission && view.mission.def.id === 'rings') {
    for (const r of view.world.rings) {
      if (r.taken) continue;
      const [mx, my] = toMap(r.pos.x, r.pos.z);
      ctx.fillStyle = '#38e0ff';
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // clearing
  const [cx, cy] = toMap(WORLD.clearing.x, WORLD.clearing.z);
  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.stroke();
  // next goal marker
  if (view.nextGoal) {
    const [gx, gy] = toMap(view.nextGoal.x, view.nextGoal.z);
    ctx.strokeStyle = '#ff5a5a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gx, gy, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  // plane arrow
  const st = view.st;
  const [px, py] = toMap(st.pos.x, st.pos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((st.heading * Math.PI) / 180);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawHUD(ctx, W, H, view) {
  const st = view.st;
  ctx.clearRect(0, 0, W, H);
  const speedKn = st.airspeed * KN;
  const altFt = st.pos.y * FT;
  const vsFpm = st.verticalSpeed * FT * 60;

  drawHeadingTape(ctx, W, st.heading);

  // Top-left: mission + goal + timer.
  const m = view.mission;
  if (m) {
    panel(ctx, 16, 54, 320, 70, 8);
    glowText(ctx, m.def.name.toUpperCase(), 30, 80, '#ffcf5a', '700 20px ui-sans-serif, system-ui');
    glowText(ctx, m.goal, 30, 104, '#dff0f8', '500 15px ui-sans-serif, system-ui');
    if (m.def.id !== 'free') {
      const t = Math.max(0, (m.def.id === 'rings' ? 150 : 0) - m.time);
      glowText(ctx, m.def.id === 'rings' ? `TIME ${t.toFixed(1)}s` : `T+ ${m.time.toFixed(1)}s`, 322, 80, '#9fe0ff', '600 15px ui-monospace, monospace', 'right');
    }
    if (m.detail) glowText(ctx, m.detail, 322, 104, '#9fe0ff', '500 13px ui-monospace, monospace', 'right');
  }

  // Left stack: airspeed + altitude.
  panel(ctx, 16, H / 2 - 90, 150, 84, 8);
  glowText(ctx, 'AIRSPEED', 30, H / 2 - 64, '#8fd0e6', '600 13px ui-monospace, monospace');
  glowText(ctx, Math.round(speedKn), 30, H / 2 - 22, '#eaf6ff', '700 44px ui-monospace, monospace');
  glowText(ctx, 'KNOTS', 150, H / 2 - 24, '#8fd0e6', '600 13px ui-monospace, monospace', 'right');

  panel(ctx, 16, H / 2 + 2, 150, 84, 8);
  glowText(ctx, 'ALTITUDE', 30, H / 2 + 28, '#8fd0e6', '600 13px ui-monospace, monospace');
  glowText(ctx, Math.round(altFt), 30, H / 2 + 70, '#eaf6ff', '700 44px ui-monospace, monospace');
  glowText(ctx, 'FEET', 150, H / 2 + 68, '#8fd0e6', '600 13px ui-monospace, monospace', 'right');

  // Right stack: vertical speed + bars.
  const rx = W - 16 - 170;
  panel(ctx, rx, H / 2 - 90, 170, 60, 8);
  glowText(ctx, 'VERT SPEED', rx + 14, H / 2 - 64, '#8fd0e6', '600 13px ui-monospace, monospace');
  const vsCol = vsFpm > 60 ? '#7dffa0' : vsFpm < -60 ? '#ff8a7a' : '#eaf6ff';
  glowText(ctx, `${vsFpm >= 0 ? '+' : ''}${Math.round(vsFpm / 10) * 10}`, rx + 156, H / 2 - 40, vsCol, '700 34px ui-monospace, monospace', 'right');
  glowText(ctx, 'FPM', rx + 156, H / 2 - 24, '#8fd0e6', '600 12px ui-monospace, monospace', 'right');

  bar(ctx, rx, H / 2 - 22, 170, 40, st.throttle, '#ffb347', 'THR', `${Math.round(st.throttle * 100)}%`);
  bar(ctx, rx, H / 2 + 24, 170, 40, st.fuel, st.fuel < 0.2 ? '#ff6a5a' : '#7dffa0', 'FUEL', `${Math.round(st.fuel * 100)}%`);
  bar(ctx, rx, H / 2 + 70, 170, 40, 1 - st.damage / 100, st.damage > 60 ? '#ff6a5a' : '#7dc8ff', 'HULL', `${Math.round(100 - st.damage)}%`);

  // Bottom-left mini map.
  const mapSize = Math.min(190, H * 0.28);
  drawMinimap(ctx, 16, H - mapSize - 16, mapSize, view);

  // Bottom-centre status line.
  const status = [];
  status.push(st.flaps > 0.05 ? `FLAPS ${Math.round(st.flaps * 100)}%` : 'FLAPS UP');
  status.push('GEAR ▼');
  if (st.brakes) status.push('BRAKE');
  if (st.onGround) status.push('GROUND');
  const line = status.join('   ·   ');
  panel(ctx, W / 2 - 190, H - 54, 380, 38, 8);
  glowText(ctx, line, W / 2, H - 28, '#cfe6f2', '600 16px ui-monospace, monospace', 'center');

  // Stall warning.
  if (st.stall) {
    const blink = Math.floor(performance.now() / 250) % 2 === 0;
    if (blink) {
      panel(ctx, W / 2 - 150, H / 2 - 150, 300, 54, 10);
      glowText(ctx, 'STALL', W / 2, H / 2 - 112, '#ff5a4a', '800 40px ui-sans-serif, system-ui', 'center');
    }
  }

  // Mute indicator.
  if (view.muted) glowText(ctx, 'MUTED', W - 20, 30, '#ff9a6a', '600 14px ui-monospace, monospace', 'right');

  // Cockpit instrument panel along the bottom.
  if (view.mode === 'cockpit' && view.drawPanel) view.drawPanel(ctx, W, H, view);
}