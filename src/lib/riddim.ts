/**
 * A one-drop riddim made in the browser with Web Audio, as the Radio's music
 * bed until a licensed recording is uploaded. Nothing to download, nothing
 * to license: kick and rim on the third beat, a skank on two and four, a
 * walking bass, a quiet hi-hat — Am7 to D7, round and round.
 */

const BPM = 74;
const BEAT = 60 / BPM;
const A1 = 55;
const CHORDS = [
  [220, 261.63, 329.63, 392], // Am7
  [293.66, 369.99, 440, 523.25], // D7
];
// Bass per bar, in beats and frequency multiples of the chord's root.
const BASS = [
  [0, 1],
  [1.5, 1],
  [2, 1.5],
  [2.5, 1.335],
  [3.5, 1.5],
];
const ROOTS = [A1 * 2, A1 * 2 * 1.335];

export interface Riddim {
  stop(): void;
}

export function startRiddim(ctx: AudioContext, out: AudioNode): Riddim {
  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const env = (node: AudioParam, at: number, peak: number, decay: number) => {
    node.setValueAtTime(0.0001, at);
    node.exponentialRampToValueAtTime(peak, at + 0.008);
    node.exponentialRampToValueAtTime(0.0001, at + decay);
  };

  const kick = (at: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(130, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.25);
    env(gain.gain, at, 0.9, 0.35);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + 0.4);
  };
  const hit = (at: number, freq: number, peak: number, decay: number) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    env(gain.gain, at, peak, decay);
    src.connect(filter).connect(gain).connect(out);
    src.start(at);
    src.stop(at + decay + 0.05);
  };
  const skank = (at: number, chord: number[]) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    const gain = ctx.createGain();
    env(gain.gain, at, 0.09, 0.16);
    filter.connect(gain).connect(out);
    for (const f of chord) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      osc.connect(filter);
      osc.start(at);
      osc.stop(at + 0.2);
    }
  };
  const bass = (at: number, freq: number, length: number) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.55, at + 0.02);
    gain.gain.setTargetAtTime(0.0001, at + length * 0.7, 0.05);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.2);
  };

  // Schedule a little ahead of the clock, a bar at a time.
  let bar = 0;
  let next = ctx.currentTime + 0.1;
  const schedule = () => {
    while (next < ctx.currentTime + 1.2) {
      const chord = bar % 2;
      kick(next + 2 * BEAT);
      hit(next + 2 * BEAT, 2500, 0.35, 0.08);
      skank(next + BEAT, CHORDS[chord]!);
      skank(next + 3 * BEAT, CHORDS[chord]!);
      for (let e = 0; e < 8; e++) hit(next + e * (BEAT / 2), 8000, e % 2 ? 0.05 : 0.08, 0.04);
      for (const [beat, ratio] of BASS) bass(next + beat! * BEAT, ROOTS[chord]! * ratio! / 2, BEAT * 0.45);
      next += 4 * BEAT;
      bar++;
    }
  };
  schedule();
  const timer = setInterval(schedule, 250);
  return { stop: () => clearInterval(timer) };
}
