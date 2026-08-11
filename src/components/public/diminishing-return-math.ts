import type { DiminishingReturnConfig } from "@/components/public/diminishing-return-config";

/** Non-negative number: digits with at most one decimal point. Empty allowed. */
export const NON_NEGATIVE_NUMERIC = /^(?:\d+(?:\.\d*)?|\.\d*)?$/;

export function parseNumericInput(value: string): number {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === ".") return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Extra raw input needed so diminished rises by 1.
 * Snapped up to 0.1 so the displayed step actually crosses the next ceil
 * breakpoint (avoids 0 on exact continuous-integer edges, e.g. raw Keyflare 33).
 * Returns null when already at the DR cap.
 */
export function neededForNextDiminishedPoint(
  config: DiminishingReturnConfig,
  sum: number,
): number | null {
  const current = config.applyDr(sum);
  if (current >= config.cap) return null;

  const target = current + 1;
  const atTarget = config.rawAtLevel(target);
  let hi = atTarget != null && atTarget > sum ? atTarget : sum + 1;
  while (config.applyDr(hi) < target) {
    hi = sum + (hi - sum) * 2;
    if (hi - sum > 1e12) return null;
  }

  let lo = sum;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (config.applyDr(mid) >= target) hi = mid;
    else lo = mid;
  }

  const delta = hi - sum;
  let step = delta <= 0 ? 0.1 : Math.ceil(delta * 10 - 1e-9) / 10;
  if (delta > 0 && step <= 0) step = 0.1;

  while (config.applyDr(sum + step) <= current && step < 1e9) {
    step = Math.round((step + 0.1) * 10) / 10;
  }
  return step;
}

export function formatNeededForNext(needed: number): string {
  if (needed <= 0) return "0.1";
  const roundedUp = Math.ceil(needed * 10 - 1e-9) / 10;
  return (roundedUp <= 0 ? 0.1 : roundedUp).toFixed(1);
}

export function isValidNumericInputString(value: string): boolean {
  return NON_NEGATIVE_NUMERIC.test(value);
}
