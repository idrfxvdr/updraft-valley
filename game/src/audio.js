// Sound, all synthesised with WebAudio oscillators and a generated noise buffer (no audio files):
// an engine hum whose pitch and gain follow the throttle, a wind rush from filtered noise that
// rises with airspeed, and a stall horn that beeps below stall speed. M mutes.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSrc = null;
  let windGain = null;
  let windFilter = null;
  let stallOsc = null;
  let stallGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);

    // Engine: two detuned saws through a lowpass.
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 900;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 61;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();

    // Wind: looping noise buffer through a bandpass.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    windSrc = ctx.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0.0;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSrc.start();

    // Stall horn.
    stallOsc = ctx.createOscillator();
    stallOsc.type = 'square';
    stallOsc.frequency.value = 440;
    stallGain = ctx.createGain();
    stallGain.gain.value = 0.0;
    stallOsc.connect(stallGain);
    stallGain.connect(master);
    stallOsc.start();

    started = true;
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = muted ? 0 : 0.7;
  }

  /** Called each frame with the flight state. */
  function update(throttle, airspeed, stall) {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    const rpm = 55 + throttle * 95;
    engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(rpm * 1.01, t, 0.08);
    engineGain.gain.setTargetAtTime(0.05 + throttle * 0.16, t, 0.1);
    const wind = Math.min(1, airspeed / 90);
    windGain.gain.setTargetAtTime(wind * 0.22, t, 0.15);
    windFilter.frequency.setTargetAtTime(400 + wind * 900, t, 0.15);
    // Stall horn beeps.
    const beep = stall ? (Math.floor(t * 4) % 2 === 0 ? 0.18 : 0.0) : 0.0;
    stallGain.gain.setTargetAtTime(beep, t, 0.02);
  }

  return { resume, update, setMuted, get muted() { return muted; } };
}