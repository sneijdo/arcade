/**
 * Single tunable source of truth for cross-cutting run constants — mirrors tactical/balance.ts's
 * organizing idea. Per-tower/per-enemy/per-wave data stays in towers.ts/enemies.ts/waves.ts.
 */
export const BALANCE = {
  economy: {
    // Tightened from 150/20/15 — this game is meant to actually punish sloppy play, not just be
    // survivable by default. Less starting cushion means the FIRST tower choice already matters;
    // fewer lives means a leaked wave costs real progress instead of being background noise.
    startingGold: 110,
    startingLives: 14,
    /** Flat gold awarded on top of a wave's own bonusGold, once per cleared wave. */
    waveClearBaseBonus: 10,
  },
  waves: {
    /** Hand-authored "story" campaign length before endless scaling takes over — see waves.ts
     * buildWaveSequence(). Long enough on its own to sustain a 60+ minute session per player ask. */
    storyWaveCount: 30,
    /** Every Nth wave (1-indexed) is a boss (troll) wave, both in the story campaign and endless. */
    bossWaveInterval: 5,
    /** Delay after clearing a wave before the next one auto-starts, if the player doesn't hit
     * "start wave" early — shortened from 14s so idling between waves isn't free breathing room,
     * without cutting it so tight that placing a tower becomes a race against the clock. */
    autoStartDelayS: 11,
  },
  scaling: {
    /** Ramp across the hand-authored story campaign (waves 1..storyWaveCount) — steep enough that
     * a setup which cleared wave 5 comfortably genuinely struggles by wave 15 if it hasn't kept
     * investing, not just a token difficulty gesture reserved for endless mode. */
    storyHpPerWave: 0.075,
    storySpeedPerWave: 0.01,
    /** Past the story campaign, growth compounds instead of adding linearly — same lesson as
     * tactical's roomScaleMults (an uncapped linear ramp plateaus in relative difficulty over a
     * long endless run; compounding keeps the challenge climbing the whole way). Capped speed
     * growth so endless enemies get tankier/more numerous rather than literally un-reactable. */
    endlessHpCompound: 1.06,
    endlessSpeedCompound: 1.018,
    endlessSpeedCap: 1.85,
    /** Gold reward scales well sub-linearly with hp (^0.4, softer than the old sqrt) so a harder
     * economy increasingly lags harder enemies — surviving late waves takes efficient tower
     * choices and upgrade timing, not just "the gold adds up eventually." */
    goldMultFromHpMult: (hpMult: number) => Math.pow(hpMult, 0.4),
  },
  juice: {
    placeFlashS: 0.35,
    hitFlashS: 0.12,
  },
} as const;
