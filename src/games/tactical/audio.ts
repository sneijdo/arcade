import { Sound } from '../../sound';

/**
 * Tactical-specific procedural sfx, layered on top of the shared Sound
 * engine's tone() primitive rather than duplicating AudioContext setup.
 * Every call randomizes pitch slightly so rapid-fire never sounds like
 * the exact same sample looping (per the "avoid identical repeats" ask).
 */
class TacticalAudio {
  private variance(base: number, pct = 0.06): number {
    return base * (1 + (Math.random() * 2 - 1) * pct);
  }

  shot(): void {
    Sound.tone(this.variance(420), 0.045, 'square', 0.05);
  }
  hit(): void {
    Sound.tone(this.variance(220), 0.06, 'triangle', 0.08);
  }
  crit(): void {
    Sound.tone(this.variance(300), 0.05, 'triangle', 0.1);
    Sound.tone(this.variance(520), 0.08, 'sine', 0.08, 0.02);
  }
  enemyDeath(): void {
    Sound.tone(this.variance(140), 0.16, 'sawtooth', 0.09);
  }
  playerHurt(): void {
    Sound.tone(this.variance(110), 0.2, 'sawtooth', 0.11);
  }
  levelUp(): void {
    Sound.tone(523, 0.1, 'sine', 0.12);
    Sound.tone(659, 0.1, 'sine', 0.11, 0.09);
    Sound.tone(784, 0.16, 'sine', 0.11, 0.18);
  }
  upgradePick(): void {
    Sound.tone(660, 0.08, 'triangle', 0.1);
  }
  waveClear(): void {
    // Was a plain two-note blip — now a short ascending triad so clearing a
    // room reads as a genuine "done!" beat, not just a UI tick.
    Sound.tone(440, 0.1, 'sine', 0.1);
    Sound.tone(587, 0.12, 'sine', 0.1, 0.09);
    Sound.tone(880, 0.2, 'sine', 0.11, 0.18);
  }
  /** Call once, right as the boss's ~0.35s burst-fire wind-up ring appears (see tactical.ts render — 'burstWindup' phase). A short rising sweep so the burst never starts as a total surprise. */
  bossWindup(): void {
    Sound.tone(180, 0.12, 'sawtooth', 0.07);
    Sound.tone(260, 0.12, 'sawtooth', 0.08, 0.08);
    Sound.tone(340, 0.14, 'sawtooth', 0.09, 0.16);
  }
  /** Call once when an elite enemy's spawn ticket resolves (its first frame in the world), before/alongside VfxSystem.warningBanner('elite', ...). */
  eliteWarning(): void {
    Sound.tone(220, 0.16, 'sawtooth', 0.09);
    Sound.tone(196, 0.2, 'sawtooth', 0.09, 0.12);
  }
  /** Call once when startRoom() enters the boss room (spawnBoss), before/alongside VfxSystem.warningBanner('boss', ...) — bigger and longer than eliteWarning so it reads as a bigger deal. */
  bossWarning(): void {
    Sound.tone(110, 0.3, 'sawtooth', 0.11);
    Sound.tone(146, 0.3, 'sawtooth', 0.1, 0.14);
    Sound.tone(98, 0.4, 'sawtooth', 0.12, 0.28);
  }
}

export const TacticalSound = new TacticalAudio();
