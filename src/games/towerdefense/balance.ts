/**
 * Single tunable source of truth for cross-cutting run constants — mirrors tactical/balance.ts's
 * organizing idea. Per-tower/per-enemy/per-wave data stays in towers.ts/enemies.ts/waves.ts.
 */
export const BALANCE = {
  economy: {
    startingGold: 150,
    startingLives: 20,
    /** Flat gold awarded on top of a wave's own bonusGold, once per cleared wave. */
    waveClearBaseBonus: 15,
  },
  waves: {
    /** Hand-authored "story" campaign length before endless scaling takes over — see waves.ts
     * buildWaveSequence(). Long enough on its own to sustain a 60+ minute session per player ask. */
    storyWaveCount: 30,
    /** Every Nth wave (1-indexed) is a boss (troll) wave, both in the story campaign and endless. */
    bossWaveInterval: 5,
    /** Delay after clearing a wave before the next one auto-starts, if the player doesn't hit
     * "start wave" early — gives breathing room to place/upgrade towers. */
    autoStartDelayS: 14,
  },
  scaling: {
    /** Gentle linear ramp across the hand-authored story campaign (waves 1..storyWaveCount) —
     * keeps early waves approachable while still meaningfully escalating well before endless mode
     * kicks in, so the campaign itself has a real difficulty curve, not just "endless is where it
     * gets hard." */
    storyHpPerWave: 0.05,
    storySpeedPerWave: 0.006,
    /** Past the story campaign, growth compounds instead of adding linearly — same lesson as
     * tactical's roomScaleMults (an uncapped linear ramp plateaus in relative difficulty over a
     * long endless run; compounding keeps the challenge climbing the whole way). Capped speed
     * growth so endless enemies get tankier/more numerous rather than literally un-reactable. */
    endlessHpCompound: 1.045,
    endlessSpeedCompound: 1.012,
    endlessSpeedCap: 1.6,
    /** Gold reward scales sub-linearly with hp (sqrt) so a harder-hitting economy doesn't fully
     * keep pace with harder enemies — the player has to out-build, not just out-farm. */
    goldMultFromHpMult: (hpMult: number) => Math.sqrt(hpMult),
  },
  juice: {
    placeFlashS: 0.35,
    hitFlashS: 0.12,
  },
} as const;
