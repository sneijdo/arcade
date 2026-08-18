import { Sound } from '../../sound';

/**
 * Ember Ward's procedural sfx — copied skeleton from tactical/audio.ts (private class + variance()
 * pitch-jitter helper + exported singleton over Sound.tone()), all-new event names/tones so nothing
 * sounds like a Breach Protocol reskin.
 */
class EmberWardAudio {
  private variance(base: number, pct = 0.06): number {
    return base * (1 + (Math.random() * 2 - 1) * pct);
  }

  towerFire(): void {
    Sound.tone(this.variance(360), 0.04, 'triangle', 0.045);
  }
  frostFire(): void {
    Sound.tone(this.variance(700), 0.05, 'sine', 0.05);
  }
  lightningFire(): void {
    Sound.tone(this.variance(880), 0.03, 'square', 0.05);
    Sound.tone(this.variance(1200), 0.03, 'square', 0.03, 0.02);
  }
  catapultFire(): void {
    Sound.tone(this.variance(140), 0.12, 'sawtooth', 0.08);
  }
  impact(): void {
    Sound.tone(this.variance(200), 0.05, 'triangle', 0.06);
  }
  shieldBreak(): void {
    Sound.tone(420, 0.08, 'square', 0.09);
    Sound.tone(280, 0.1, 'square', 0.07, 0.05);
  }
  enemyDeath(): void {
    Sound.tone(this.variance(150), 0.14, 'sawtooth', 0.08);
  }
  leak(): void {
    Sound.tone(140, 0.22, 'sawtooth', 0.12);
    Sound.tone(100, 0.26, 'sawtooth', 0.1, 0.08);
  }
  towerPlace(): void {
    Sound.tone(523, 0.08, 'sine', 0.1);
    Sound.tone(784, 0.1, 'sine', 0.09, 0.06);
  }
  towerUpgrade(): void {
    Sound.tone(523, 0.08, 'sine', 0.11);
    Sound.tone(659, 0.09, 'sine', 0.1, 0.06);
    Sound.tone(880, 0.14, 'sine', 0.1, 0.14);
  }
  waveStart(): void {
    Sound.tone(220, 0.1, 'sawtooth', 0.07);
    Sound.tone(294, 0.12, 'sawtooth', 0.07, 0.08);
  }
  waveClear(): void {
    Sound.tone(440, 0.1, 'sine', 0.1);
    Sound.tone(587, 0.12, 'sine', 0.1, 0.09);
    Sound.tone(880, 0.2, 'sine', 0.11, 0.18);
  }
  bossWarning(): void {
    Sound.tone(110, 0.3, 'sawtooth', 0.11);
    Sound.tone(146, 0.3, 'sawtooth', 0.1, 0.14);
    Sound.tone(98, 0.4, 'sawtooth', 0.12, 0.28);
  }
}

export const EmberWardSound = new EmberWardAudio();
