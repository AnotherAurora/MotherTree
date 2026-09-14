import {
  resolveRelicValueScalar,
  type RelicArgKind,
  type RelicBaseFormula,
} from "@/lib/path-carver/relic-research-curve";
import {
  DEFAULT_COPY_INSTANCE_FIELDS,
  NON_REALM_MANIFESTATION_FIELDS,
  type AllStats,
  type Manifestation,
  type Tag,
  type TargetType,
} from "@/lib/team-data/types";

/** One `relic_tag_manifestation` row reduced to the fields the engine needs. */
export type RelicRtmRow = {
  /** `relic_tag_manifestation.id`. */
  id: number;
  tagId: number;
  tagName: string;
  triggerCondition: number | null;
  valueScalar: number | null;
  kind: RelicArgKind;
  baseFormula: RelicBaseFormula | null;
  targetType: TargetType | null;
  dependencyStat: AllStats | null;
  isAccumulating: boolean;
  /**
   * Row value is a percent (tag `is_percent`, or a `enemy_max_hp` dependency).
   * Display-only: the engine consumes the raw scalar unchanged.
   */
  isPercent: boolean;
};

/** One relic family with its damage rows, resolved from the public catalog. */
export type RelicCatalogEntry = {
  relicId: number;
  name: string;
  tier: string;
  requiredRealmId: number | null;
  isDamage: boolean;
  manifestations: RelicRtmRow[];
};

export type RelicValueInputs = {
  accountLevel: number;
  ownedPosseCount: number;
  /** Doubles the resolved value of `computed` relic rows; `fixed` rows are unaffected. */
  hsr: boolean;
};

/**
 * Relic rows are absolute providers: the engine marks `sourceKind: "relic"`
 * interaction-immune, so a relic's value affects other tags but is never
 * amplified by awakener/gear tags. `requiredRealmId` carries the relic-wide
 * realm gate onto every row so `isManifestationApplied` filters as a unit.
 */
export function buildRelicManifestations(
  entry: RelicCatalogEntry,
  inputs: RelicValueInputs,
): Manifestation[] {
  const rows: Manifestation[] = [];
  for (const row of entry.manifestations) {
    rows.push({
      id: row.id,
      sourceKind: "relic",
      awakenerId: null,
      slotIndex: null,
      sourceName: entry.name,
      tagId: row.tagId,
      tagName: row.tagName,
      triggerCondition: row.triggerCondition,
      valueScalar: resolveRelicValueScalar({
        kind: row.kind,
        baseFormula: row.baseFormula,
        valueScalar: row.valueScalar,
        accountLevel: inputs.accountLevel,
        ownedPosseCount: inputs.ownedPosseCount,
        hsr: inputs.hsr,
      }),
      ...DEFAULT_COPY_INSTANCE_FIELDS,
      dependencyStat: row.dependencyStat,
      sourceType: null,
      targetType: row.targetType,
      buffTargetTypeRestriction: null,
      metadata: null,
      isAccumulating: row.isAccumulating,
      requiredEnlightenment: null,
      requiredAwakenerId: null,
      requiredAwakenerName: null,
      requiredRealm: null,
      requiredRealm2: null,
      requiredRealmId: entry.requiredRealmId,
      requiredRealmId2: null,
      replacesManifestationId: null,
      interactionOverrides: [],
      isBaseStatTransfer: false,
      isCreatedBase: false,
      ...NON_REALM_MANIFESTATION_FIELDS,
    });
  }
  return rows;
}

/**
 * Opaque key for the effect a relic applies for a given input set. Two relics
 * with the same signature resolve to identical engine manifestations, so their
 * standalone impact is identical and only one of them needs to be evaluated.
 *
 * Derived from the *resolved* manifestations to stay in lockstep with the
 * engine; display/identity fields (`id`, names) and the already-satisfied
 * `requiredRealmId` gate are intentionally excluded.
 */
export function relicEffectSignature(
  entry: RelicCatalogEntry,
  inputs: RelicValueInputs,
): string {
  const parts = buildRelicManifestations(entry, inputs).map((m) =>
    [
      m.tagId,
      m.triggerCondition ?? "",
      m.valueScalar ?? "",
      m.dependencyStat ?? "",
      m.targetType ?? "",
      m.isAccumulating ? 1 : 0,
    ].join("\u0001"),
  );
  parts.sort();
  return parts.join("\u0002");
}

export type RelicEffectGroups = {
  /** member relicId → representative relicId (first in catalog order). */
  representativeOf: Map<number, number>;
  /** representative relicId → member relicIds (catalog order). */
  membersByRepresentative: Map<number, number[]>;
  /** member relicId → number of relics sharing its effect. */
  sizeOf: Map<number, number>;
};

/**
 * Group relics whose resolved effects are identical. The first entry in catalog
 * order becomes the representative; the engine is only run for representatives
 * and the resulting total is shared with every member.
 */
export function groupRelicsByEffect(
  entries: readonly RelicCatalogEntry[],
  inputs: RelicValueInputs,
): RelicEffectGroups {
  const representativeOf = new Map<number, number>();
  const membersByRepresentative = new Map<number, number[]>();
  const sizeOf = new Map<number, number>();
  const representativeBySignature = new Map<string, number>();

  for (const entry of entries) {
    const signature = relicEffectSignature(entry, inputs);
    let representativeId = representativeBySignature.get(signature);
    if (representativeId == null) {
      representativeId = entry.relicId;
      representativeBySignature.set(signature, representativeId);
      membersByRepresentative.set(representativeId, []);
    }
    membersByRepresentative.get(representativeId)!.push(entry.relicId);
    representativeOf.set(entry.relicId, representativeId);
  }
  for (const members of membersByRepresentative.values()) {
    for (const memberId of members) sizeOf.set(memberId, members.length);
  }

  return { representativeOf, membersByRepresentative, sizeOf };
}

/**
 * Ensure every tag referenced by the relic catalog exists in `tagsById`.
 * Public `tag` reads normally cover these; stubs guard against a missing row.
 */
export function ensureRelicTags(
  tagsById: Record<number, Tag>,
  entries: Iterable<RelicCatalogEntry>,
): void {
  for (const entry of entries) {
    for (const row of entry.manifestations) {
      if (tagsById[row.tagId] == null) {
        tagsById[row.tagId] = {
          id: row.tagId,
          tagName: row.tagName || `Missing.Tag.${row.tagId}`,
          layer: null,
          isPercent: false,
          isAdditive: true,
        };
      }
    }
  }
}

/** Group flat relic manifestation rows by relic id / catalog metadata. */
export function groupRelicManifestations(
  entries: readonly {
    relicId: number;
    name: string;
    tier: string;
    requiredRealmId: number | null;
    isDamage: boolean;
  }[],
  rows: readonly (RelicRtmRow & { relicId: number })[],
): RelicCatalogEntry[] {
  const byRelicId = new Map<number, RelicCatalogEntry>();
  for (const entry of entries) {
    byRelicId.set(entry.relicId, { ...entry, manifestations: [] });
  }
  for (const row of rows) {
    const entry = byRelicId.get(row.relicId);
    if (!entry) continue;
    entry.manifestations.push(row);
  }
  return [...byRelicId.values()];
}
