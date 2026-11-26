// Kestrel Post — synthesised sound: engine, wind, chimes and thuds.
// One job: all audio from WebAudio oscillators and filtered noise, no audio
// files, started on the first user gesture as browsers require.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let started = false;

  function start() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Engine: a low sawtooth through a muffling filter, pitch follows RPM.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      // Wind: looped noise through a bandpass, loudness follows airspeed.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter).connect(windGain).connect(ctx.destination);
      noise.start();
    } catch {
      ctx = null;
    }
  }

  function tone(freq, at, dur, type = 'sine', vol = 0.16) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime + at);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + dur + 0.02);
  }

  return {
    start,
    // Called every frame with the plane's state; cheap parameter updates.
    update(plane, running) {
      if (!ctx || !engineOsc) return;
      const rpm = running ? 55 + plane.throttle * 85 : 0;
      engineOsc.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(running ? 0.05 + plane.throttle * 0.05 : 0, ctx.currentTime, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.12, plane.speed * 0.0016), ctx.currentTime, 0.15);
    },
    ring() {
      tone(880, 0, 0.16);
      tone(1318, 0.09, 0.24);
    },
    thud() {
      tone(70, 0, 0.28, 'triangle', 0.3);
      tone(48, 0.02, 0.34, 'sine', 0.3);
    },
    crash() {
      tone(120, 0, 0.5, 'sawtooth', 0.22);
      tone(60, 0.05, 0.7, 'triangle', 0.28);
    },
    click() {
      tone(660, 0, 0.07, 'square', 0.06);
    },
    fanfare() {
      tone(523, 0, 0.16);
      tone(659, 0.13, 0.16);
      tone(784, 0.26, 0.3);
    },
  };
}
