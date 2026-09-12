import { combineSameTagScalar } from "@/lib/path-carver/combine-same-tag-scalar";
import {
  effectiveManifestationScalar,
  type EffectiveScalarOptions,
} from "@/lib/path-carver/effective-value-scalar";
import { ATTACKER_TENTACLE_TAG_ID } from "@/lib/path-carver/hit-tentacle-attack";
import {
  DEFAULT_COPY_INSTANCE_FIELDS,
  NON_REALM_MANIFESTATION_FIELDS,
  type Awakener,
  type Manifestation,
  type Tag,
  type TargetType,
} from "@/lib/team-data/types";

/** Special.All Tentacle Attack (DB tag id 180). */
export const SPECIAL_ALL_TENTACLE_ATTACK_TAG_ID = 180;

export const SUPPORT_GENERATE_TEMPORARY_TENTACLE_TAG_ID = 57;
export const SUPPORT_GENERATE_PERMANENT_TENTACLE_TAG_ID = 58;

const GENERATE_TENTACLE_TAG_IDS: readonly number[] = [
  SUPPORT_GENERATE_TEMPORARY_TENTACLE_TAG_ID,
  SUPPORT_GENERATE_PERMANENT_TENTACLE_TAG_ID,
];

const ALL_TENTACLE_ATTACK_LABEL = "Special.All Tentacle Attack → Tentacle";

const DERIVED_ID_OFFSET = 5_000_000;
const ALL_TENTACLE_ATTACK_ID_OFFSET = 6_400_000;

type OwnerKey = string;
type OwnerTotals = Map<OwnerKey, Map<number, number>>;

export type AllTentacleAttackStep = {
  kind: "special";
  label: string;
  detail: string;
};

function ownerKeyFor(m: Manifestation): OwnerKey {
  if (m.sourceKind === "posse") return "posse";
  if (m.sourceKind === "relic") return "relic";
  if (m.sourceKind === "realm") return "realm";
  if (m.awakenerId != null) return `awakener:${m.awakenerId}`;
  return `orphan:${m.sourceKind}:${m.id}`;
}

function getOwnerValue(
  ownerValues: OwnerTotals,
  owner: OwnerKey,
  tagId: number,
): number {
  return ownerValues.get(owner)?.get(tagId) ?? 0;
}

function setOwnerValue(
  ownerValues: OwnerTotals,
  owner: OwnerKey,
  tagId: number,
  value: number,
): void {
  let map = ownerValues.get(owner);
  if (!map) {
    map = new Map();
    ownerValues.set(owner, map);
  }
  if (value === 0) {
    map.delete(tagId);
  } else {
    map.set(tagId, value);
  }
}

function mergeOwnerValue(
  ownerValues: OwnerTotals,
  owner: OwnerKey,
  tag: Tag | undefined,
  tagId: number,
  incoming: number,
): void {
  if (incoming === 0) return;
  const current = ownerValues.get(owner)?.get(tagId);
  const combined = combineSameTagScalar(
    current,
    incoming,
    tag?.isAdditive !== false,
    tag?.isPercent === true,
  );
  setOwnerValue(ownerValues, owner, tagId, combined);
}

function sourceLabelFor(
  m: Manifestation,
  awakenerNamesById?: ReadonlyMap<number, string>,
): string {
  if (m.sourceKind === "posse") {
    return m.sourceName ?? "posse";
  }
  if (m.sourceKind === "relic") {
    return m.sourceName != null ? `relic:${m.sourceName}` : "relic";
  }
  if (m.sourceKind === "realm") {
    return m.sourceName != null ? `realm:${m.sourceName}` : "realm";
  }

  const awakenerName =
    m.awakenerId != null
      ? (awakenerNamesById?.get(m.awakenerId) ?? `#${m.awakenerId}`)
      : null;

  if (m.sourceKind === "awakener") {
    return (
      m.sourceName ??
      awakenerName ??
      `awakener #${m.id}`
    );
  }

  const entityName = m.sourceName ?? m.sourceKind;
  if (awakenerName != null) {
    return `${entityName} (${awakenerName})`;
  }
  return m.sourceName != null ? entityName : `${entityName} #${m.id}`;
}

/**
 * Team Generate pool for *team* creates_base (non-self Generate rows only).
 * Mirrors computeScopedModifierValue(..., TEAM_POOL_OWNER) on Layer A scalars.
 */
function sumGenerateTagForTeamPool(
  applied: readonly Manifestation[],
  tagId: number,
  tagsById: Readonly<Record<number, Tag>>,
  awakenersById: ReadonlyMap<number, Awakener>,
  scalarOpts: EffectiveScalarOptions,
): number {
  const tag = tagsById[tagId];
  let combined: number | undefined;

  for (const m of applied) {
    if (m.tagId !== tagId) continue;
    if (m.targetType === "self") continue;
    const scalar = effectiveManifestationScalar(
      m,
      awakenersById,
      tagsById,
      scalarOpts,
    );
    if (scalar === 0) continue;
    combined = combineSameTagScalar(
      combined,
      scalar,
      tag?.isAdditive !== false,
      tag?.isPercent === true,
    );
  }

  return combined ?? 0;
}

/** Sum team Generate Temporary + Permanent (tags 57/58). */
export function sumGeneratedTentaclePool(
  applied: readonly Manifestation[],
  tagsById: Readonly<Record<number, Tag>>,
  awakenersById: ReadonlyMap<number, Awakener>,
  scalarOpts: EffectiveScalarOptions,
): number {
  let total = 0;
  for (const tagId of GENERATE_TENTACLE_TAG_IDS) {
    total += sumGenerateTagForTeamPool(
      applied,
      tagId,
      tagsById,
      awakenersById,
      scalarOpts,
    );
  }
  return total;
}

export function allTentacleAttackSyntheticId(
  awakenerId: number,
  sourceManifestationId: number,
): number {
  return -(
    DERIVED_ID_OFFSET +
    ALL_TENTACLE_ATTACK_ID_OFFSET +
    awakenerId * 1_000 +
    (sourceManifestationId % 1_000)
  );
}

export function buildAllTentacleAttackSynthetic(
  tentacleTag: Tag,
  source: Manifestation,
  value: number,
  targetType: TargetType | null,
  sourceLabel: string,
): Manifestation {
  const awakenerId = source.awakenerId ?? 0;
  return {
    id: allTentacleAttackSyntheticId(awakenerId, source.id),
    sourceKind: source.sourceKind,
    awakenerId: source.awakenerId,
    slotIndex: source.slotIndex,
    sourceName: sourceLabel,
    tagId: tentacleTag.id,
    tagName: tentacleTag.tagName,
    triggerCondition: null,
    valueScalar: value,
    ...DEFAULT_COPY_INSTANCE_FIELDS,
    dependencyStat: null,
    sourceType: source.sourceType,
    targetType: targetType ?? "aoe",
    buffTargetTypeRestriction: null,
    metadata: source.metadata,
    isAccumulating: false,
    requiredEnlightenment: null,
    requiredAwakenerId: null,
    requiredAwakenerName: null,
    requiredRealm: null,
    requiredRealm2: null,
    requiredRealmId: null,
    requiredRealmId2: null,
    replacesManifestationId: null,
    interactionOverrides: [],
    isBaseStatTransfer: false,
    isCreatedBase: true,
    ...NON_REALM_MANIFESTATION_FIELDS,
  };
}

export type ApplyAllTentacleAttackHopInput = {
  ownerValues: OwnerTotals;
  appliedManifestations: readonly Manifestation[];
  tagsById: Readonly<Record<number, Tag>>;
  awakenersById: ReadonlyMap<number, Awakener>;
  awakenerNamesById?: ReadonlyMap<number, string>;
  teamMaxHp?: number | null;
  realmMasteryTotal?: number;
  teamRealms?: EffectiveScalarOptions["teamRealms"];
};

export type ApplyAllTentacleAttackHopResult = {
  generatePool: number;
  steps: AllTentacleAttackStep[];
  synthetics: Manifestation[];
};

/**
 * Hop 4f — team Generate pool × Special.All Tentacle Attack multiplier
 * → Attacker.Tentacle on holder owner (target_type inherited).
 */
export function applyAllTentacleAttackHop(
  input: ApplyAllTentacleAttackHopInput,
): ApplyAllTentacleAttackHopResult {
  const scalarOpts: EffectiveScalarOptions = {
    teamMaxHp: input.teamMaxHp,
    realmMasteryTotal: input.realmMasteryTotal,
    teamRealms: input.teamRealms,
  };

  const generatePool = sumGeneratedTentaclePool(
    input.appliedManifestations,
    input.tagsById,
    input.awakenersById,
    scalarOpts,
  );

  const steps: AllTentacleAttackStep[] = [];
  const synthetics: Manifestation[] = [];

  if (generatePool === 0) {
    return { generatePool, steps, synthetics };
  }

  const tentacleTag = input.tagsById[ATTACKER_TENTACLE_TAG_ID];
  if (tentacleTag == null) {
    return { generatePool, steps, synthetics };
  }

  let anyApplied = false;

  for (const m of input.appliedManifestations) {
    if (m.tagId !== SPECIAL_ALL_TENTACLE_ATTACK_TAG_ID) continue;

    const multiplier = effectiveManifestationScalar(
      m,
      input.awakenersById,
      input.tagsById,
      scalarOpts,
    );
    if (multiplier === 0) continue;

    const added = generatePool * multiplier;
    if (added === 0) continue;

    const owner = ownerKeyFor(m);
    const before = getOwnerValue(
      input.ownerValues,
      owner,
      ATTACKER_TENTACLE_TAG_ID,
    );
    mergeOwnerValue(
      input.ownerValues,
      owner,
      tentacleTag,
      ATTACKER_TENTACLE_TAG_ID,
      added,
    );
    const after = getOwnerValue(
      input.ownerValues,
      owner,
      ATTACKER_TENTACLE_TAG_ID,
    );

    const sourceLabel = sourceLabelFor(m, input.awakenerNamesById);
    synthetics.push(
      buildAllTentacleAttackSynthetic(
        tentacleTag,
        m,
        added,
        m.targetType,
        sourceLabel,
      ),
    );

    steps.push({
      kind: "special",
      label: ALL_TENTACLE_ATTACK_LABEL,
      detail:
        `generatePool=${generatePool} × mult=${multiplier} → +${added}` +
        ` | ${sourceLabel}` +
        ` | owner=${owner} targetType=${m.targetType ?? "aoe"}` +
        ` | Tentacle ${before} → ${after}`,
    });
    anyApplied = true;
  }

  if (anyApplied && steps.length > 0) {
    steps.unshift({
      kind: "special",
      label: "Special.All Tentacle Attack pool",
      detail: `generatePool=${generatePool} (Generate Temporary + Permanent, team non-self)`,
    });
  }

  return { generatePool, steps, synthetics };
}
