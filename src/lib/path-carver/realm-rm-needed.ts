import { ceilRealmMastery } from "@/lib/path-carver/effective-value-scalar";

/**
 * Extra Realm Mastery needed so a realm "from RM" row
 * (value = ceil(effectiveRate × ceil(RM))) rises by 1.
 *
 * Snapped up to 0.1 and floored at 0.1 so the row never reads 0 — this guards
 * float loss at extreme RM and mirrors the sibling "needed for +1" helpers
 * (diminishing-return / death-resist trigger).
 */
export function rmNeededForNextStep(
  realmMastery: number,
  effectiveRate: number,
): number {
  if (!(effectiveRate > 0)) return 0.1;

  const current = Number.isFinite(realmMastery)
    ? Math.max(0, realmMastery)
    : 0;
  const rmCeil = Math.max(0, ceilRealmMastery(current));
  const fromRm = Math.ceil(effectiveRate * rmCeil);
  const targetRmCeil = Math.floor(fromRm / effectiveRate) + 1;

  const delta = targetRmCeil - current;
  const step = delta <= 0 ? 0.1 : Math.ceil(delta * 10 - 1e-9) / 10;
  return step <= 0 ? 0.1 : step;
}
