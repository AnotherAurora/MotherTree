import {
  effectiveManifestationScalar,
  type EffectiveScalarOptions,
} from "@/lib/path-carver/effective-value-scalar";
import type { Awakener, Manifestation, Tag } from "@/lib/team-data/types";

/** Support.Crit Damage — exact id only (not Support.Crit Damage.*). */
export const SUPPORT_CRIT_DAMAGE_TAG_ID = 17;
/** Support.Crit Rate — exact id only (not Support.Crit Rate.*). */
export const SUPPORT_CRIT_RATE_TAG_ID = 18;

export const TENTACLE_CRIT_DAMAGE_LABEL = "Tentacle Crit Damage";
export const TENTACLE_CRIT_RATE_LABEL = "Tentacle Crit Rate";

export type TentacleCritBreakdown = {
  baseSum: number;
  basePart: number;
  supportAoeSum: number;
  supportNonAoeSum: number;
  supportNonAoePart: number;
  supportPart: number;
  total: number;
};

export type ComputeTentacleCritInput = {
  awakeners: readonly Pick<Awakener, "critDmg" | "critRate">[];
  appliedManifestations: readonly Manifestation[];
  awakenersById: ReadonlyMap<number, Awakener>;
  tagsById: Readonly<Record<number, Tag>>;
  scalarOpts?: EffectiveScalarOptions;
};

type SupportCritBuckets = {
  aoe: number;
  nonAoe: number;
};

function sumBaseStat(
  awakeners: readonly Pick<Awakener, "critDmg" | "critRate">[],
  read: (a: Pick<Awakener, "critDmg" | "critRate">) => number | null,
): number {
  let sum = 0;
  for (const awakener of awakeners) {
    sum += read(awakener) ?? 0;
  }
  return sum;
}

/**
 * Exact-id Support.Crit rows only. Skips base-stat transfers and any row with
 * buffTargetTypeRestriction set (strict — no leafContext match).
 * aoe adds directly; self / single / null go into the /4 bucket.
 */
function sumSupportCritExact(
  input: ComputeTentacleCritInput,
  tagId: number,
): SupportCritBuckets {
  let aoe = 0;
  let nonAoe = 0;
  for (const m of input.appliedManifestations) {
    if (m.tagId !== tagId) continue;
    if (m.isBaseStatTransfer) continue;
    if (m.buffTargetTypeRestriction != null) continue;
    const scalar = effectiveManifestationScalar(
      m,
      input.awakenersById,
      input.tagsById,
      input.scalarOpts,
    );
    if (scalar === 0) continue;
    if (m.targetType === "aoe") {
      aoe += scalar;
    } else {
      nonAoe += scalar;
    }
  }
  return { aoe, nonAoe };
}

function ceilPercent(value: number): number {
  return Math.ceil(value * 100 - 1e-10) / 100;
}

function assembleBreakdown(
  baseSum: number,
  support: SupportCritBuckets,
): TentacleCritBreakdown {
  const basePart = ceilPercent(baseSum / 2);
  const supportNonAoePart = ceilPercent(support.nonAoe / 4);
  const supportPart = support.aoe + supportNonAoePart;
  return {
    baseSum,
    basePart,
    supportAoeSum: support.aoe,
    supportNonAoeSum: support.nonAoe,
    supportNonAoePart,
    supportPart,
    total: basePart + supportPart,
  };
}

export function computeTentacleCritDamage(
  input: ComputeTentacleCritInput,
): TentacleCritBreakdown {
  return assembleBreakdown(
    sumBaseStat(input.awakeners, (a) => a.critDmg),
    sumSupportCritExact(input, SUPPORT_CRIT_DAMAGE_TAG_ID),
  );
}

export function computeTentacleCritRate(
  input: ComputeTentacleCritInput,
): TentacleCritBreakdown {
  return assembleBreakdown(
    sumBaseStat(input.awakeners, (a) => a.critRate),
    sumSupportCritExact(input, SUPPORT_CRIT_RATE_TAG_ID),
  );
}

export function formatTentacleCritDetail(
  breakdown: TentacleCritBreakdown,
): string {
  return (
    `base=ceil%(${breakdown.baseSum}/2)=${breakdown.basePart}` +
    ` aoe=${breakdown.supportAoeSum}` +
    ` nonAoe=${breakdown.supportNonAoeSum}` +
    `→ceil%(${breakdown.supportNonAoeSum}/4)=${breakdown.supportNonAoePart}` +
    ` total=${breakdown.total}`
  );
}
