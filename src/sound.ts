/** Lightweight generated tones — no external audio assets. */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  /** Public so per-game audio modules (see games/tactical/audio.ts) can compose their own palette without duplicating AudioContext setup. */
  tone(freq: number, dur: number, type: OscillatorType = 'sine', gainPeak = 0.14, delay = 0): void {
    if (this.muted) return;
    try {
      const c = this.ensureCtx();
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // audio unsupported / blocked — silently ignore
    }
  }

  setMuted(v: boolean): void {
    this.muted = v;
  }
  isMuted(): boolean {
    return this.muted;
  }
  click(): void {
    this.tone(320, 0.06, 'square', 0.06);
  }
  countdown(): void {
    this.tone(440, 0.09, 'sine', 0.1);
  }
  target(): void {
    this.tone(880, 0.12, 'sine', 0.13);
    this.tone(1320, 0.1, 'sine', 0.07, 0.02);
  }
  hit(): void {
    this.tone(660, 0.09, 'triangle', 0.12);
  }
  mistake(): void {
    this.tone(160, 0.28, 'sawtooth', 0.12);
  }
  complete(): void {
    this.tone(523, 0.12, 'sine', 0.12);
    this.tone(659, 0.12, 'sine', 0.1, 0.1);
    this.tone(784, 0.18, 'sine', 0.1, 0.2);
  }
  pb(): void {
    this.tone(660, 0.1, 'sine', 0.13);
    this.tone(880, 0.1, 'sine', 0.12, 0.09);
    this.tone(1108, 0.16, 'sine', 0.12, 0.18);
    this.tone(1318, 0.22, 'sine', 0.12, 0.27);
  }
  achievement(): void {
    this.tone(784, 0.1, 'triangle', 0.12);
    this.tone(988, 0.1, 'triangle', 0.11, 0.1);
    this.tone(1318, 0.24, 'triangle', 0.12, 0.2);
  }
}

export const Sound = new SoundEngine();
