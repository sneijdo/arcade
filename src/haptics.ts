/** Thin wrapper around navigator.vibrate — no-ops silently where unsupported (iOS Safari, desktop). */
function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export const Haptics = {
  hit(): void {
    if (canVibrate()) navigator.vibrate(12);
  },
  miss(): void {
    if (canVibrate()) navigator.vibrate([15, 40, 15]);
  },
  personalBest(): void {
    if (canVibrate()) navigator.vibrate([10, 30, 10, 30, 20]);
  },
  tap(): void {
    if (canVibrate()) navigator.vibrate(6);
  },
};
