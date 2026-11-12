// Web Audio synthesis: every sound effect and the music are generated at
// runtime (no audio files). Buses: sfx / music / ambience → compressor → out,
// with a shared convolution reverb send.

type SfxOpts = { vol?: number; pitch?: number; pan?: number };

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface Track {
  bpm: number;
  chords: number[][]; // midi notes per bar
  bass: number[]; // root per bar
  drums: boolean;
  arpPattern: number[];
}

const TRACKS: Record<string, Track> = {
  title: {
    bpm: 76,
    chords: [
      [57, 60, 64, 71],
      [53, 57, 60, 67],
      [48, 52, 55, 62],
      [55, 59, 62, 66],
    ],
    bass: [33, 29, 36, 31],
    drums: false,
    arpPattern: [0, 2, 1, 3, 2, 1, 3, 2],
  },
  stage: {
    bpm: 102,
    chords: [
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [50, 53, 57, 60],
      [52, 55, 59, 62],
    ],
    bass: [33, 29, 26, 28],
    drums: true,
    arpPattern: [0, 1, 2, 3, 2, 1, 2, 3],
  },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private out!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private ambBus!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private delay!: DelayNode;
  private delayFb!: GainNode;
  private noise!: AudioBuffer;
  private musicTimer: number | null = null;
  private track: Track | null = null;
  private trackName = '';
  private step = 0;
  private nextTime = 0;
  private musicGain: GainNode | null = null;
  private ambience: { src: AudioBufferSourceNode; g: GainNode }[] = [];
  private lastPlay = new Map<string, number>();

  volumes = { master: 0.8, music: 0.55, sfx: 0.8 };

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.build();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private build(): void {
    const ctx = this.ctx!;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    this.out = ctx.createGain();
    this.out.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    this.sfxBus.connect(this.out);
    this.musicBus.connect(this.out);
    this.ambBus.connect(this.out);
    // reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.6, 2.2);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.9;
    this.reverbSend.connect(this.reverb).connect(this.out);
    // tempo delay for arps
    this.delay = ctx.createDelay(1.5);
    this.delayFb = ctx.createGain();
    this.delayFb.gain.value = 0.38;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 2400;
    this.delay.connect(dlp).connect(this.delayFb).connect(this.delay);
    dlp.connect(this.musicBus);
    // noise
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.7, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.volumes.sfx * 0.55, t, 0.05);
  }

  // ---------------------------------------------------------------------------
  // Primitive voices
  // ---------------------------------------------------------------------------

  private env(g: GainNode, t: number, a: number, peak: number, dec: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.001, a));
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    t: number,
    dur: number,
    vol: number,
    dest: AudioNode,
    attack = 0.003,
    detune = 0,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    this.env(g, t, attack, vol, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  private noiseBurst(
    t: number,
    dur: number,
    vol: number,
    filter: BiquadFilterType,
    f0: number,
    f1: number,
    q: number,
    dest: AudioNode,
    attack = 0.002,
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    this.env(g, t, attack, vol, dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + dur + 0.05);
  }

  // ---------------------------------------------------------------------------
  // Sound effects
  // ---------------------------------------------------------------------------

  play(name: string, opts: SfxOpts = {}): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    // simple voice limiting for rapid repeats
    const last = this.lastPlay.get(name) ?? 0;
    if (now - last < 0.025) return;
    this.lastPlay.set(name, now);
    const v = opts.vol ?? 1;
    const p = opts.pitch ?? 1;
    const pan = ctx.createStereoPanner();
    pan.pan.value = opts.pan ?? 0;
    pan.connect(this.sfxBus);
    const dest = pan;
    const verb = ctx.createGain();
    verb.gain.value = 0.25;
    verb.connect(this.reverbSend);
    const t = now + 0.002;
    switch (name) {
      case 'fire':
        this.tone('square', 1500 * p, 380 * p, t, 0.08, 0.07 * v, dest);
        this.noiseBurst(t, 0.09, 0.25 * v, 'bandpass', 4200, 1800, 2, dest);
        this.tone('sawtooth', 220 * p, 90 * p, t, 0.06, 0.05 * v, dest);
        break;
      case 'attach':
        this.tone('triangle', 880 * p, 860 * p, t, 0.28, 0.12 * v, dest);
        this.tone('triangle', 1325 * p, 1300 * p, t, 0.2, 0.07 * v, verb);
        this.tone('sine', 150, 55, t, 0.12, 0.35 * v, dest);
        this.noiseBurst(t, 0.035, 0.4 * v, 'highpass', 3000, 3000, 0.7, dest);
        break;
      case 'miss':
        this.noiseBurst(t, 0.12, 0.08 * v, 'bandpass', 1400, 500, 1.5, dest);
        break;
      case 'clink':
        this.tone('sine', 2500 * p, 2450 * p, t, 0.14, 0.09 * v, dest);
        this.tone('sine', 3700 * p, 3650 * p, t, 0.1, 0.05 * v, verb);
        this.noiseBurst(t, 0.03, 0.2 * v, 'highpass', 5000, 5000, 0.7, dest);
        break;
      case 'release':
        this.noiseBurst(t, 0.16, 0.18 * v, 'bandpass', 700, 2600, 1.2, dest, 0.02);
        break;
      case 'whoosh':
        this.noiseBurst(t, 0.34, 0.4 * v, 'bandpass', 380 * p, 3200 * p, 1.6, dest, 0.04);
        this.tone('sine', 180 * p, 420 * p, t, 0.25, 0.06 * v, dest, 0.03);
        break;
      case 'jump':
        this.tone('square', 210 * p, 420 * p, t, 0.07, 0.045 * v, dest);
        this.noiseBurst(t, 0.06, 0.12 * v, 'lowpass', 1800, 900, 0.8, dest);
        break;
      case 'land':
        this.tone('sine', 120, 42, t, 0.13, 0.4 * v, dest);
        this.noiseBurst(t, 0.09, 0.25 * v, 'lowpass', 1400, 300, 0.7, dest);
        break;
      case 'step':
        this.noiseBurst(t, 0.035, 0.16 * v, 'bandpass', 900 + Math.random() * 500, 600, 1.2, dest);
        break;
      case 'dash':
        this.noiseBurst(t, 0.18, 0.4 * v, 'bandpass', 900, 3600, 1.4, dest, 0.01);
        this.tone('sawtooth', 280, 1100, t, 0.12, 0.06 * v, dest);
        this.tone('sine', 90, 50, t, 0.1, 0.25 * v, dest);
        break;
      case 'slash':
        this.noiseBurst(t, 0.13, 0.45 * v, 'highpass', 1400 * p, 5200 * p, 0.9, dest, 0.01);
        this.tone('sine', 1900 * p, 1700 * p, t + 0.03, 0.16, 0.05 * v, verb);
        break;
      case 'hurt':
        this.tone('square', 320, 110, t, 0.2, 0.12 * v, dest);
        this.noiseBurst(t, 0.15, 0.35 * v, 'lowpass', 2400, 400, 0.8, dest);
        break;
      case 'zap':
        this.tone('sawtooth', 62, 58, t, 0.32, 0.18 * v, dest);
        this.tone('square', 124, 118, t, 0.25, 0.06 * v, dest);
        for (let i = 0; i < 6; i++) this.noiseBurst(t + i * 0.04, 0.02, 0.3 * v, 'highpass', 4000, 4000, 1, dest);
        break;
      case 'death':
        this.tone('sawtooth', 420, 36, t, 1.0, 0.16 * v, dest, 0.01);
        this.tone('sine', 210, 30, t, 1.1, 0.2 * v, verb, 0.01);
        this.noiseBurst(t, 0.5, 0.25 * v, 'lowpass', 3000, 120, 0.7, dest);
        break;
      case 'checkpoint':
        [72, 76, 79, 84].forEach((n, i) => {
          this.tone('triangle', NOTE(n), NOTE(n), t + i * 0.07, 0.4, 0.08 * v, dest);
          this.tone('sine', NOTE(n + 12), NOTE(n + 12), t + i * 0.07, 0.3, 0.03 * v, verb);
        });
        break;
      case 'log':
        [76, 83, 88, 91].forEach((n, i) => this.tone('sine', NOTE(n), NOTE(n), t + i * 0.09, 0.6, 0.07 * v, i % 2 ? verb : dest));
        this.noiseBurst(t, 0.4, 0.05 * v, 'highpass', 7000, 9000, 1, verb, 0.1);
        break;
      case 'clear':
        [69, 72, 76, 81, 84, 88].forEach((n, i) => {
          this.tone('square', NOTE(n), NOTE(n), t + i * 0.1, 0.5, 0.04 * v, dest);
          this.tone('triangle', NOTE(n - 12), NOTE(n - 12), t + i * 0.1, 0.6, 0.06 * v, verb);
        });
        break;
      case 'ui_move':
        this.tone('square', 1200, 1180, t, 0.03, 0.03 * v, dest);
        break;
      case 'ui_select':
        this.tone('square', 880, 880, t, 0.05, 0.04 * v, dest);
        this.tone('square', 1320, 1320, t + 0.05, 0.08, 0.04 * v, dest);
        break;
      case 'ui_back':
        this.tone('square', 660, 440, t, 0.08, 0.035 * v, dest);
        break;
      case 'type':
        this.tone('square', 1800 + Math.random() * 300, 1800, t, 0.012, 0.012 * v, dest);
        break;
      case 'thunder':
        this.noiseBurst(t, 2.8, 0.5 * v, 'lowpass', 420, 60, 0.6, dest, 0.12);
        this.noiseBurst(t + 0.1, 2.2, 0.25 * v, 'lowpass', 900, 100, 0.6, verb, 0.05);
        break;
      // --- combat -------------------------------------------------------------
      case 'hit':
        this.noiseBurst(t, 0.07, 0.55 * v, 'bandpass', 2600 * p, 900, 1.1, dest);
        this.tone('square', 190 * p, 70, t, 0.09, 0.16 * v, dest);
        this.tone('sine', 1400 * p, 1200 * p, t + 0.01, 0.12, 0.05 * v, verb);
        break;
      case 'zipstrike':
        this.noiseBurst(t, 0.12, 0.7 * v, 'bandpass', 3400, 700, 1.0, dest);
        this.tone('sawtooth', 240, 50, t, 0.18, 0.2 * v, dest);
        this.tone('sine', 90, 35, t, 0.22, 0.45 * v, dest);
        this.tone('triangle', 2200, 1800, t + 0.02, 0.25, 0.06 * v, verb);
        break;
      case 'kill':
        this.noiseBurst(t, 0.09, 0.6 * v, 'bandpass', 3000, 800, 1, dest);
        this.tone('square', 260, 60, t, 0.14, 0.16 * v, dest);
        this.tone('sine', 1800, 2400, t + 0.03, 0.18, 0.05 * v, verb);
        break;
      case 'explode':
        this.noiseBurst(t, 0.6, 0.6 * v, 'lowpass', 2600, 90, 0.7, dest, 0.005);
        this.tone('sine', 110, 30, t, 0.45, 0.5 * v, dest);
        this.noiseBurst(t + 0.03, 0.9, 0.2 * v, 'lowpass', 900, 80, 0.6, verb, 0.02);
        break;
      case 'block':
        this.tone('square', 1200, 1150, t, 0.06, 0.08 * v, dest);
        this.tone('triangle', 2400, 2300, t, 0.18, 0.08 * v, verb);
        this.noiseBurst(t, 0.05, 0.45 * v, 'highpass', 3500, 3500, 0.8, dest);
        break;
      case 'deflect':
        this.tone('sawtooth', 600, 1800, t, 0.12, 0.1 * v, dest);
        this.tone('sine', 2600, 2600, t + 0.02, 0.2, 0.06 * v, verb);
        break;
      case 'zip':
        this.tone('sawtooth', 300, 1300, t, 0.16, 0.08 * v, dest);
        this.noiseBurst(t, 0.18, 0.35 * v, 'bandpass', 900, 4200, 1.4, dest, 0.01);
        break;
      case 'charge':
        this.tone('sawtooth', 200 * p, 900 * p, t, 0.45, 0.06 * v, dest, 0.02);
        this.tone('square', 400 * p, 1800 * p, t, 0.45, 0.025 * v, dest, 0.02);
        break;
      case 'drone_dash':
        this.noiseBurst(t, 0.3, 0.35 * v, 'bandpass', 1200, 300, 1.5, dest);
        this.tone('sawtooth', 700, 200, t, 0.3, 0.06 * v, dest);
        break;
      case 'lock':
        this.tone('square', 1760 * p, 1760 * p, t, 0.05, 0.04 * v, dest);
        this.tone('square', 1760 * p, 1760 * p, t + 0.08, 0.05, 0.04 * v, dest);
        break;
      case 'shoot':
        this.tone('square', 900, 200, t, 0.1, 0.07 * v, dest);
        this.noiseBurst(t, 0.06, 0.25 * v, 'bandpass', 3000, 1500, 1.2, dest);
        break;
      case 'alert':
        this.tone('square', 700, 700, t, 0.06, 0.05 * v, dest);
        this.tone('square', 1050, 1050, t + 0.07, 0.08, 0.05 * v, dest);
        break;
      case 'bash':
        this.noiseBurst(t, 0.14, 0.4 * v, 'bandpass', 600, 2400, 1.2, dest, 0.01);
        this.tone('sine', 130, 60, t + 0.05, 0.12, 0.3 * v, dest);
        break;
      case 'boot':
        this.tone('sine', 110, 880, t, 0.6, 0.08 * v, verb, 0.05);
        this.noiseBurst(t, 0.5, 0.06 * v, 'bandpass', 600, 4000, 3, dest, 0.2);
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Ambience: rain + city drone
  // ---------------------------------------------------------------------------

  startAmbience(): void {
    if (!this.ready || this.ambience.length) return;
    const ctx = this.ctx!;
    const mk = (type: BiquadFilterType, f: number, q: number, vol: number, rate: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      src.playbackRate.value = rate;
      const fl = ctx.createBiquadFilter();
      fl.type = type;
      fl.frequency.value = f;
      fl.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(vol, ctx.currentTime, 1.2);
      src.connect(fl).connect(g).connect(this.ambBus);
      src.start();
      this.ambience.push({ src, g });
    };
    mk('highpass', 2500, 0.5, 0.06, 1); // rain hiss
    mk('bandpass', 900, 0.6, 0.05, 0.7); // rain body
    mk('lowpass', 120, 0.9, 0.12, 0.3); // city rumble
  }

  stopAmbience(): void {
    if (!this.ctx) return;
    for (const a of this.ambience) {
      a.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
      a.src.stop(this.ctx.currentTime + 2);
    }
    this.ambience = [];
  }

  // ---------------------------------------------------------------------------
  // Music sequencer
  // ---------------------------------------------------------------------------

  playMusic(name: keyof typeof TRACKS): void {
    if (!this.ready) return;
    if (this.trackName === name && this.musicTimer !== null) return;
    this.stopMusic(0.6);
    const ctx = this.ctx!;
    this.track = TRACKS[name];
    this.trackName = name;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.15;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    this.musicGain.connect(this.musicBus);
    this.delay.delayTime.value = (60 / this.track.bpm) * 0.75;
    this.musicTimer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic(fade = 1): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.trackName = '';
    if (this.musicGain && this.ctx) {
      const g = this.musicGain;
      g.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
      setTimeout(() => g.disconnect(), fade * 1000 + 500);
    }
    this.musicGain = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    const tr = this.track;
    if (!ctx || !tr || !this.musicGain) return;
    const s16 = 60 / tr.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, tr, s16);
      this.nextTime += s16;
      this.step++;
    }
  }

  private playStep(step: number, t: number, tr: Track, s16: number): void {
    const out = this.musicGain!;
    const bar = Math.floor(step / 16) % tr.chords.length;
    const pos = step % 16;
    const chord = tr.chords[bar];
    // pad at bar start
    if (pos === 0) {
      for (const n of chord) {
        for (const det of [-9, 9]) this.padVoice(NOTE(n), t, s16 * 16, det, out);
      }
    }
    // arpeggio on 8ths
    if (pos % 2 === 0) {
      const idx = tr.arpPattern[(pos / 2) % tr.arpPattern.length];
      const n = chord[idx % chord.length] + 12;
      this.pluck(NOTE(n), t, s16 * 1.6, tr.drums ? 0.035 : 0.03, out);
    }
    // bass
    const root = tr.bass[bar];
    if (tr.drums) {
      if (pos % 2 === 0) this.bassVoice(NOTE(root + (pos % 8 === 6 ? 12 : 0)), t, s16 * 1.8, 0.11, out);
      if (pos === 0 || pos === 8 || pos === 10) this.kick(t, out);
      if (pos === 4 || pos === 12) this.snare(t, out);
      if (pos % 2 === 1) this.hat(t, pos % 4 === 3 ? 0.05 : 0.025, out);
    } else if (pos === 0 || pos === 10) {
      this.bassVoice(NOTE(root), t, s16 * 8, 0.09, out);
    }
  }

  private padVoice(f: number, t: number, dur: number, detune: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = detune;
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(500, t);
    fl.frequency.linearRampToValueAtTime(1400, t + dur * 0.5);
    fl.frequency.linearRampToValueAtTime(600, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.012, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.02);
    o.connect(fl).connect(g);
    g.connect(out);
    g.connect(this.reverbSend);
    o.start(t);
    o.stop(t + dur * 1.05);
  }

  private pluck(f: number, t: number, dur: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(3200, t);
    fl.frequency.exponentialRampToValueAtTime(500, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.004, vol, dur);
    o.connect(fl).connect(g);
    g.connect(out);
    g.connect(this.delay);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private bassVoice(f: number, t: number, dur: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.Q.value = 6;
    fl.frequency.setValueAtTime(900, t);
    fl.frequency.exponentialRampToValueAtTime(160, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.005, vol, dur);
    o.connect(fl).connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number, out: AudioNode): void {
    this.tone('sine', 140, 38, t, 0.22, 0.5, out, 0.002);
  }

  private snare(t: number, out: AudioNode): void {
    this.noiseBurst(t, 0.16, 0.22, 'bandpass', 1800, 1200, 0.9, out);
    this.tone('triangle', 220, 160, t, 0.08, 0.08, out);
    this.noiseBurst(t, 0.2, 0.08, 'bandpass', 1800, 1200, 0.9, this.reverbSend);
  }

  private hat(t: number, vol: number, out: AudioNode): void {
    this.noiseBurst(t, 0.03, vol, 'highpass', 7500, 7500, 0.8, out);
  }
}

export const audio = new AudioEngine();
