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
    /** Hand-authored campaign length before endless scaling takes over — see waves.ts's
     * buildStorySequence(). Score (waves survived) is the leaderboard's competitive axis, so this
     * stays open-ended rather than capped: a solid player clears a good chunk of it in the
     * 5-10 minute range a quick-round arcade game should hit, and a genuinely great player keeps
     * pushing into endless mode for a higher score than anyone who stopped at the campaign. */
    storyWaveCount: 30,
    /** Every Nth wave (1-indexed) is a boss (troll) wave, both in the campaign and endless. */
    bossWaveInterval: 5,
    /** Delay after clearing a wave before the next one auto-starts, if the player doesn't hit
     * "start wave" early — kept short for turbo pacing: enough time to place one tower via the
     * picker modal, not enough to sit around between waves. */
    autoStartDelayS: 8,
  },
  scaling: {
    /** Ramp across the hand-authored campaign (waves 1..storyWaveCount) — steeper than a long-form
     * session would strictly need, because the goal isn't "survive 30 waves at a leisurely pace,"
     * it's "a strong player's run ends from rising difficulty within a turbo-length session," with
     * endless mode past that as the real skill ceiling for leaderboard competition. */
    storyHpPerWave: 0.09,
    storySpeedPerWave: 0.012,
    /** Past the campaign, growth compounds instead of adding linearly — same lesson as tactical's
     * roomScaleMults (an uncapped linear ramp plateaus in relative difficulty over a long endless
     * run; compounding keeps the challenge climbing the whole way, which is what actually makes
     * "waves survived" a meaningful leaderboard score at the top end). Capped speed growth so
     * endless enemies get tankier/more numerous rather than literally un-reactable. */
    endlessHpCompound: 1.06,
    endlessSpeedCompound: 1.018,
    endlessSpeedCap: 1.85,
    /** Gold reward scales well sub-linearly with hp (^0.4, softer than a straight sqrt) so a harder
     * economy increasingly lags enemy toughness — pushing deep into endless mode takes efficient
     * tower choices and upgrade timing, not just "the gold adds up eventually." */
    goldMultFromHpMult: (hpMult: number) => Math.pow(hpMult, 0.4),
  },
  juice: {
    placeFlashS: 0.35,
    hitFlashS: 0.12,
  },
} as const;
