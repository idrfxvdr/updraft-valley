// The cockpit instrument panel, drawn on the 2D overlay along the bottom of the screen in cockpit
// view: six lit round gauges — airspeed, attitude (artificial horizon), altimeter, heading, vertical
// speed and fuel — plus a row of annunciators. Bezelled in dark metal with a warm instrument glow.
const KN = 1.94384;
const FT = 3.28084;

function bezel(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#14181d';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2c333b';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r - 4, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0d10';
  ctx.fill();
}

function ticks(ctx, x, y, r, n, major) {
  ctx.strokeStyle = 'rgba(230,240,250,0.85)';
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const big = i % major === 0;
    const r1 = r - (big ? 12 : 7);
    ctx.lineWidth = big ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3));
    ctx.stroke();
  }
}

function needle(ctx, x, y, r, angle, color = '#ff5a4a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(0, -(r - 10));
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#c8ccd0';
  ctx.fill();
}

function label(ctx, text, x, y, color = '#9fe0ff') {
  ctx.font = '600 12px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function airspeedGauge(ctx, x, y, r, kn) {
  bezel(ctx, x, y, r);
  ticks(ctx, x, y, r, 20, 5);
  const a = -Math.PI * 0.75 + Math.min(1, kn / 160) * Math.PI * 1.5;
  needle(ctx, x, y, r, a + Math.PI / 2);
  label(ctx, 'AIRSPEED', x, y + r * 0.45);
  label(ctx, `${Math.round(kn)}`, x, y + r * 0.72, '#eaf6ff');
}

function attitudeGauge(ctx, x, y, r, pitch, roll) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 4, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-roll);
  const off = pitch * r * 1.4;
  ctx.fillStyle = '#2f6fb0';
  ctx.fillRect(-r * 2, -r * 2 + off, r * 4, r * 2);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(-r * 2, off, r * 4, r * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 2, off);
  ctx.lineTo(r * 2, off);
  ctx.stroke();
  ctx.restore();
  bezel(ctx, x, y, r);
  // fixed aircraft symbol
  ctx.strokeStyle = '#ffcf5a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y);
  ctx.lineTo(x - r * 0.15, y);
  ctx.moveTo(x + r * 0.15, y);
  ctx.lineTo(x + r * 0.5, y);
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y + 4);
  ctx.stroke();
  label(ctx, 'ATTITUDE', x, y + r * 0.72);
}

function altimeterGauge(ctx, x, y, r, ft) {
  bezel(ctx, x, y, r);
  ticks(ctx, x, y, r, 10, 1);
  const a = (ft / 1000) * Math.PI * 2;
  needle(ctx, x, y, r, a);
  label(ctx, 'ALT FT', x, y + r * 0.45);
  label(ctx, `${Math.round(ft)}`, x, y + r * 0.72, '#eaf6ff');
}

function headingGauge(ctx, x, y, r, hdg) {
  bezel(ctx, x, y, r);
  ticks(ctx, x, y, r, 12, 3);
  needle(ctx, x, y, r, (hdg * Math.PI) / 180, '#7dffa0');
  label(ctx, 'HDG', x, y + r * 0.45);
  label(ctx, `${Math.round(hdg) % 360}`.padStart(3, '0'), x, y + r * 0.72, '#eaf6ff');
}

function vsiGauge(ctx, x, y, r, fpm) {
  bezel(ctx, x, y, r);
  ticks(ctx, x, y, r, 8, 2);
  const a = Math.max(-1, Math.min(1, fpm / 2000)) * Math.PI * 0.6;
  needle(ctx, x, y, r, a, '#7dc8ff');
  label(ctx, 'VSI FPM', x, y + r * 0.45);
  label(ctx, `${Math.round(fpm / 10) * 10}`, x, y + r * 0.72, '#eaf6ff');
}

function fuelGauge(ctx, x, y, r, frac) {
  bezel(ctx, x, y, r);
  ticks(ctx, x, y, r, 8, 2);
  const a = -Math.PI * 0.6 + frac * Math.PI * 1.2;
  needle(ctx, x, y, r, a + Math.PI / 2, frac < 0.2 ? '#ff5a4a' : '#7dffa0');
  label(ctx, 'FUEL', x, y + r * 0.45);
  label(ctx, `${Math.round(frac * 100)}%`, x, y + r * 0.72, '#eaf6ff');
}

export function drawPanel(ctx, W, H, view) {
  const st = view.st;
  const r = Math.min(58, H * 0.085);
  const cy = H - r - 26;
  const gap = r * 2 + 26;
  const total = gap * 5;
  const startX = W / 2 - total / 2 + gap / 2;
  // Panel backing.
  ctx.fillStyle = 'rgba(10,13,16,0.82)';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, cy - r - 14);
  ctx.quadraticCurveTo(W / 2, cy - r - 40, W, cy - r - 14);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,200,230,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const kn = st.airspeed * KN;
  const ft = st.pos.y * FT;
  const fpm = st.verticalSpeed * FT * 60;
  const pitch = Math.asin(Math.max(-1, Math.min(1, view.forwardY || 0)));
  const roll = view.roll || 0;

  airspeedGauge(ctx, startX, cy, r, kn);
  attitudeGauge(ctx, startX + gap, cy, r, pitch, roll);
  altimeterGauge(ctx, startX + gap * 2, cy, r, ft);
  headingGauge(ctx, startX + gap * 3, cy, r, st.heading);
  vsiGauge(ctx, startX + gap * 4, cy, r, fpm);
  fuelGauge(ctx, startX + gap * 5, cy, r, st.fuel);

  // Annunciators row under the gauges.
  const ann = [];
  ann.push(st.stall ? 'STALL' : '');
  ann.push(st.onGround ? 'GND' : '');
  ann.push(st.flaps > 0.05 ? 'FLAP' : '');
  ctx.font = '700 13px ui-monospace, monospace';
  ctx.textAlign = 'center';
  let ax = startX - gap * 0.5 + gap * 0.5;
  const ay = cy + r + 16;
  for (const a of ann) {
    if (!a) continue;
    ctx.fillStyle = a === 'STALL' ? '#ff5a4a' : '#7dffa0';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.fillText(a, ax, ay);
    ax += 70;
    ctx.shadowBlur = 0;
  }
}