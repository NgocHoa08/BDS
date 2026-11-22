// Procedural Lo-Fi Autumn Chill Background Music Engine (Pure Web Audio API)
// Warm Rhodes-style maj7/9 chords + delicate pentatonic chimes + gentle filtered reverb

const BPM = 68;
const BEAT_MS = (60 / BPM) * 1000;

// Classic cozy autumn lo-fi progression in F major (MIDI notes)
const CHORDS: number[][] = [
  [53, 57, 60, 64, 67], // Fmaj9
  [50, 53, 57, 60, 64], // Dm9
  [46, 50, 53, 57, 60], // Bbmaj9
  [48, 53, 55, 58, 62], // C9sus4
  [45, 52, 55, 60, 64], // Am7
  [50, 53, 57, 60, 64], // Dm9
  [43, 50, 53, 57, 58], // Gm9
  [48, 52, 58, 62, 67], // C13
];

// Gentle F major pentatonic melody pool
const MELODY_POOL = [65, 67, 69, 72, 74, 77, 79]; // F4 G4 A4 C5 D5 F5 G5

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class ChillMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private timer: number | null = null;
  private running = false;
  private enabled = true;
  private volume = 0.45;
  private step = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.connect(ctx.destination);
      this.masterGain = master;

      // Warm low-pass bus for cohesive lo-fi tone
      const busFilter = ctx.createBiquadFilter();
      busFilter.type = 'lowpass';
      busFilter.frequency.setValueAtTime(1650, ctx.currentTime);
      busFilter.Q.setValueAtTime(0.6, ctx.currentTime);

      const musicBus = ctx.createGain();
      musicBus.gain.setValueAtTime(1, ctx.currentTime);
      musicBus.connect(busFilter);
      busFilter.connect(master);
      this.musicBus = musicBus;

      // Cozy stereo-like soft feedback delay (reverb-ish tail)
      const delay = ctx.createDelay(1.0);
      delay.delayTime.setValueAtTime(0.38, ctx.currentTime);
      const fb = ctx.createGain();
      fb.gain.setValueAtTime(0.28, ctx.currentTime);
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.setValueAtTime(1150, ctx.currentTime);

      const wetGain = ctx.createGain();
      wetGain.gain.setValueAtTime(0.34, ctx.currentTime);

      musicBus.connect(delay);
      delay.connect(delayFilter);
      delayFilter.connect(fb);
      fb.connect(delay);
      delayFilter.connect(wetGain);
      wetGain.connect(master);
      this.delayNode = delay;

      // Subtle warm autumn breeze / vinyl texture
      const bufSize = ctx.sampleRate * 3;
      const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 2.2;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      noise.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(420, ctx.currentTime);
      noiseFilter.Q.setValueAtTime(0.8, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.018, ctx.currentTime);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(master);
      noise.start();
      this.noiseSource = noise;
      this.noiseGain = noiseGain;
    }
    return this.ctx;
  }

  private playRhodesNote(midi: number, when: number, duration: number, velocity: number) {
    if (!this.ctx || !this.musicBus) return;
    const freq = midiToHz(midi);

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, when);
    osc2.frequency.setValueAtTime(freq * 2, when);
    osc2.detune.setValueAtTime(3.5, when);

    const g1 = this.ctx.createGain();
    const g2 = this.ctx.createGain();
    g1.gain.setValueAtTime(0.0001, when);
    g1.gain.linearRampToValueAtTime(velocity, when + 0.045);
    g1.gain.exponentialRampToValueAtTime(velocity * 0.42, when + duration * 0.55);
    g1.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    g2.gain.setValueAtTime(0.0001, when);
    g2.gain.linearRampToValueAtTime(velocity * 0.14, when + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, when + Math.min(0.6, duration * 0.4));

    osc1.connect(g1);
    osc2.connect(g2);
    g1.connect(this.musicBus);
    g2.connect(this.musicBus);

    osc1.start(when);
    osc2.start(when);
    osc1.stop(when + duration + 0.05);
    osc2.stop(when + duration + 0.05);
  }

  private playWarmBass(midi: number, when: number, duration: number) {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(midiToHz(midi - 12), when);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.11, when + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  private scheduleTick() {
    if (!this.running || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime + 0.04;
    const chordIdx = Math.floor(this.step / 8) % CHORDS.length;
    const beatInBar = this.step % 8; // 8 eighth-notes per bar (4 beats)
    const chord = CHORDS[chordIdx];
    const barDur = (BEAT_MS * 4) / 1000;

    // Beat 0: lush arpeggiated autumn Rhodes chord + warm bass
    if (beatInBar === 0) {
      this.playWarmBass(chord[0], now, barDur * 1.02);
      chord.forEach((note, i) => {
        this.playRhodesNote(note, now + i * 0.055, barDur * 0.96, 0.068 - i * 0.005);
      });
    }

    // Gentle mid-bar shimmer chord voicing on beat 4
    if (beatInBar === 4 && Math.random() < 0.55) {
      const subset = chord.slice(1, 4);
      subset.forEach((note, i) => {
        this.playRhodesNote(note, now + i * 0.04, barDur * 0.55, 0.032);
      });
    }

    // Sparse dreamy pentatonic bell melody on chill off-beats
    if ((beatInBar === 2 || beatInBar === 5 || beatInBar === 7) && Math.random() < 0.48) {
      const note = MELODY_POOL[(this.step * 3 + chordIdx * 2 + Math.floor(Math.random() * 3)) % MELODY_POOL.length];
      this.playRhodesNote(note, now, 1.85, 0.042);
    }

    this.step = (this.step + 1) % (CHORDS.length * 8);
  }

  public unlockAndStart(enabled: boolean, volume: number): void {
    this.enabled = enabled;
    this.volume = volume;
    if (!enabled) return;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
    this.masterGain.gain.linearRampToValueAtTime(Math.max(0.0001, this.volume * 0.65), now + 1.2);

    if (!this.running) {
      this.running = true;
      this.scheduleTick();
      this.timer = window.setInterval(() => this.scheduleTick(), BEAT_MS / 2);
    }
  }

  public setEnabled(enabled: boolean, volume = this.volume): void {
    this.enabled = enabled;
    this.volume = volume;
    if (enabled) {
      this.unlockAndStart(true, volume);
      return;
    }
    this.stop();
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.masterGain && this.enabled && this.running) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(Math.max(0.0001, this.volume * 0.65), now + 0.15);
    }
  }

  public stop(): void {
    this.running = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.4);
    }
  }

  public isPlaying(): boolean {
    return this.running && this.enabled;
  }
}

export const chillMusic = new ChillMusicEngine();
