/** Lightweight generated tones — no external audio assets. */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor();
    }
    // Browsers create AudioContext in a 'suspended' state until resumed from
    // a user gesture — without this, every tone silently no-ops on a lot of
    // mobile browsers even though nothing here throws.
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Call from the earliest possible user gesture (see main.ts) to unlock audio ASAP, before any game actually needs a sound. */
  unlock(): void {
    try {
      this.ensureCtx();
    } catch {
      // audio unsupported — ignore, tone() already guards every real playback
    }
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

  /** Snake — crunchy bite when eating food. */
  eat(): void {
    this.tone(300, 0.05, 'triangle', 0.13);
    this.tone(220, 0.07, 'square', 0.08, 0.02);
  }
  /** Snake — harsher than the generic mistake() to sell "you just died". */
  death(): void {
    this.tone(220, 0.1, 'sawtooth', 0.13);
    this.tone(140, 0.3, 'sawtooth', 0.13, 0.08);
  }
  /** Merge — pitch scales up with the merged tile's value so bigger merges feel bigger. */
  merge(value: number): void {
    const steps = Math.log2(Math.max(2, value)); // 2→1, 4→2, ... 2048→11
    const freq = 300 + steps * 55;
    this.tone(freq, 0.09, 'sine', 0.12);
    this.tone(freq * 1.5, 0.09, 'sine', 0.08, 0.03);
  }
  /** Stack Tower — block landing thud. */
  place(): void {
    this.tone(180, 0.08, 'square', 0.1);
  }
  /** Stack Tower — bright chime for an exact/perfect stack. */
  perfect(): void {
    this.tone(988, 0.09, 'triangle', 0.12);
    this.tone(1318, 0.14, 'triangle', 0.1, 0.06);
  }
  /** Dash — quick whoosh as an obstacle passes. */
  whoosh(): void {
    this.tone(500, 0.06, 'sine', 0.05);
    this.tone(260, 0.08, 'sine', 0.06, 0.03);
  }
  /** Memory — one distinct pitch per sequence step (i = 0-based tile index). */
  note(i: number): void {
    const scale = [392, 440, 523, 587, 659, 784, 880, 988];
    this.tone(scale[i % scale.length], 0.16, 'sine', 0.12);
  }
  /** Overclock — short rising tick while charging, pitch climbs with the multiplier. */
  charge(multiplier: number): void {
    this.tone(260 + Math.min(600, (multiplier - 1) * 90), 0.06, 'square', 0.06);
  }
  /** Overclock — satisfying bank chime. */
  bank(): void {
    this.tone(600, 0.08, 'triangle', 0.12);
    this.tone(900, 0.12, 'triangle', 0.11, 0.05);
  }
  /** Overclock — harsh overload/bust. */
  overload(): void {
    this.tone(180, 0.05, 'sawtooth', 0.15);
    this.tone(90, 0.35, 'sawtooth', 0.15, 0.05);
  }
  /** Pulse — the procedural rhythm track's strong (downbeat) kick. */
  beatKick(): void {
    this.tone(110, 0.1, 'sine', 0.14);
  }
  /** Pulse — the procedural rhythm track's weak (off-beat) hat. */
  beatHat(): void {
    this.tone(1600, 0.03, 'square', 0.045);
  }
  /** Drop Zone — soft tick as the ball bounces off a peg. */
  pegBounce(): void {
    this.tone(700 + Math.random() * 300, 0.035, 'sine', 0.06);
  }
  /** Drop Zone — landing chime, pitch scales with the bin's value so a big win sounds bigger. */
  binLand(value: number): void {
    const freq = 300 + Math.min(700, value);
    this.tone(freq, 0.1, 'triangle', 0.13);
    this.tone(freq * 1.5, 0.14, 'triangle', 0.1, 0.05);
  }
  /** Shop — the purchase-reveal fanfare (see showPurchaseReveal in pages/shop.ts). A rising
   * major-chord arpeggio that grows an extra layer per rarity tier, so a legendary pull sounds
   * unmistakably bigger than a common one instead of every purchase getting the same little blip. */
  purchase(tier: 0 | 1 | 2 | 3 = 0): void {
    this.tone(523, 0.11, 'triangle', 0.12);
    this.tone(659, 0.11, 'triangle', 0.11, 0.07);
    this.tone(784, 0.16, 'triangle', 0.11, 0.14);
    if (tier >= 1) this.tone(1046, 0.18, 'triangle', 0.1, 0.21);
    if (tier >= 2) this.tone(1318, 0.22, 'sine', 0.1, 0.28);
    if (tier >= 3) {
      this.tone(1568, 0.3, 'sine', 0.11, 0.35);
      this.tone(2093, 0.34, 'sine', 0.07, 0.4);
    }
  }
}

export const Sound = new SoundEngine();
