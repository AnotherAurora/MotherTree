import {
  awakenerStatForDependency,
  buildAwakenersById,
  effectiveManifestationScalar,
  effectiveOverrideFactor,
  isInteractionImmuneSubject,
  isPercentDependencyStat,
  sumTeamRealmMastery,
  type EffectiveScalarOptions,
} from "@/lib/path-carver/effective-value-scalar";
import { manifestationHitCountKey } from "@/lib/path-carver/copy-instances";
import { combineSameTagScalar } from "@/lib/path-carver/combine-same-tag-scalar";
import {
  ATTACKER_POISON_FIXED_TAG_ID,
  ATTACKER_TENTACLE_TAG_ID,
  buildHitTentacleSynthetics,
  collectPrePoolTentacleAttackBuckets,
  combineTentacleHitPoisonScalarForOwner,
  combineTduFamilyPoolBreakdown,
  computeHitTentacleProduct,
  isHitTentacleSkipModifier,
  SPECIAL_TENTACLE_HIT_POISON_TAG_ID,
  TENTACLE_TDU_FAMILY_POOL_LABEL,
} from "@/lib/path-carver/hit-tentacle-attack";
import {
  computeTentacleCritDamage,
  computeTentacleCritRate,
  formatTentacleCritDetail,
  TENTACLE_CRIT_DAMAGE_LABEL,
  TENTACLE_CRIT_RATE_LABEL,
} from "@/lib/path-carver/tentacle-crit";
import { matchesDemandTag } from "@/lib/simulator/tag-matching";
import type { TeamRealmResolution } from "@/lib/team-data/resolve-team-realms";
import {
  DEFAULT_COPY_INSTANCE_FIELDS,
  NON_REALM_MANIFESTATION_FIELDS,
  type Awakener,
  type AwakenerLocalManifestationInteraction,
  type DefaultInteraction,
  type Layer,
  type Manifestation,
  type OperationType,
  type SourceType,
  type Tag,
  type TargetType,
  type TeamData,
} from "@/lib/team-data/types";

/** Multi-pass chain limit until values stabilize. Documented for Phase 2a/2b/2c. */
export const INTERACTION_MAX_PASSES = 8;

/** @deprecated Prefer subject-centric evaluation; kept for Attacker.* checks. */
export function isLeafManifestation(m: Manifestation): boolean {
  return m.tagName.startsWith("Attacker.");
}

export function isAttackerTagName(tagName: string): boolean {
  return tagName.startsWith("Attacker.");
}

/** Existence-gated targets: interactions must not invent these without Layer A base. */
export function isAttackerOrDefenderTag(tagName: string): boolean {
  return (
    tagName.startsWith("Attacker.") || tagName.startsWith("Defender.")
  );
}

/**
 * Amplify rows require Layer A / created-base presence.
 * Create rows (createsBase) may invent Support and Attacker/Defender targets.
 */
export function requiresTargetBasePresence(
  interaction: DefaultInteraction,
  _targetTagName: string,
): boolean {
  return !interaction.createsBase;
}

const TEAM_POOL_OWNER = "*team*";
const REALM_OWNER = "realm";
const DEFERRED_CREATE_SUBJECT_KEY = "deferred-create";
const DEFERRED_CREATE_SUBJECT_LABEL = "Deferred create (closure)";
const DEFERRED_STACK_AMPLIFY_SUBJECT_KEY = "deferred-stack-amplify";
const DEFERRED_STACK_AMPLIFY_SUBJECT_LABEL =
  "Deferred stack amplify (closure0)";
const DEFERRED_AMPLIFY_SUBJECT_KEY = "deferred-amplify";
const DEFERRED_AMPLIFY_SUBJECT_LABEL = "Deferred amplify (closure)";
const HIT_TENTACLE_SUBJECT_LABEL = "Hit = Tentacle Attack";
const TENTACLE_HIT_POISON_SUBJECT_LABEL = "Tentacle Hit = Poison";
const TENTACLE_TDU_POOL_SUBJECT_LABEL = "Tentacle TDU pool";
const SPECIAL_HIT_TENTACLE_ATTACK = "Special.Hit = Tentacle Attack";
const SPECIAL_TENTACLE_HIT_POISON = "Special.Tentacle Hit = Poison";
const TENTACLE_TDU_POOL_ID_OFFSET = 6_000_000;
const TENTACLE_POISON_FIXED_ID_OFFSET = 6_200_000;

const SPECIAL_CORROSION_CONVERSION = "Special.Corrosion Conversion";
const SPECIAL_EMBERS_CONVERSION = "Special.Ancient Embers Conversion";
const DEBUFF_CORROSION = "Support.Debuff.Corrosion";
const DEBUFF_EMBERS = "Support.Debuff.Ancient Embers";
const ACTIVE_DAMAGE = "Attacker.Active Damage";
const ATTACKER_POISON_FIXED = "Attacker.Poison.Fixed";
const TENTACLE = "Attacker.Tentacle";
const NON_ACTIVE_DAMAGE = "Attacker.Non-Active Damage";
const CORROSION_DAMAGE = "Attacker.Corrosion Damage";
const EMBERS_DAMAGE = "Attacker.Ancient Embers Damage";

type OwnerKey = string;
type OwnerTotals = Map<OwnerKey, Map<number, number>>;

/** Placeholder until Phase 1/2 stamps the owning subject path. */
const UNSET_SUBJECT_KEY = "unset";
const UNSET_SUBJECT_LABEL = "unset";
const PHASE1_CREATE_SUBJECT_KEY = "phase1-create";
const PHASE1_CREATE_SUBJECT_LABEL = "Phase 1 create (team)";

export type ScalarMathStep =
  | {
      kind: "base";
      tagId: number;
      tagName: string;
      owner: string;
      /** Effective scalar after dependency_stat scaling (Phase 2b). */
      scalar: number;
      /** Raw value_scalar before dependency_stat scaling. */
      rawScalar: number;
      sourceLabel: string;
      /** Subject path key (sourceKind:id) for debug regrouping. */
      subjectKey: string;
      /** Subject path display label for debug regrouping. */
      subjectLabel: string;
      /** ATM / manifestation metadata for subject-header debug display. */
      metadata: string | null;
    }
  | {
      kind: "op";
      tagId: number;
      tagName: string;
      owner: string;
      op: OperationType;
      modifierTagName: string;
      modifierValue: number;
      factor: number;
      before: number;
      afterRaw: number;
      after: number;
      rounded: boolean;
      pass: number;
      /** Modifier manifestation sources that drove this op (for debug display). */
      effectSources: string[];
      /**
       * Set when this op came from an interaction with buff_target_type_restriction
       * that matched the leaf context (Phase 2b). Skipped restrictions emit no step.
       */
      buffRestrictionMet?: SourceType;
      /** Leaf source_type context for the run that produced this op. */
      leafContext?: SourceType | null;
      /** Effective layer band for this op (local unique_scaling layer wins when set). */
      layer: Layer | null;
      /**
       * Phase 3b — unique_scaling provenance for Review Tags debug.
       * Absent for plain tag_default_interaction ops.
       */
      uniqueScaling?: "patch" | "invent" | "base_stat";
      /** Subject path key (sourceKind:id or phase1-create) for debug regrouping. */
      subjectKey: string;
      /** Subject path display label for debug regrouping. */
      subjectLabel: string;
    }
  | {
      kind: "hitCount";
      tagId: number;
      tagName: string;
      owner: string;
      sourceLabel: string;
      /** Subject value after Layer B (single-hit). */
      finishedOnce: number;
      hitCount: number;
      /** finishedOnce × hitCount. */
      after: number;
      /** Compact instances × copies note. */
      detail: string;
      /** Subject path key (sourceKind:id) for debug regrouping. */
      subjectKey: string;
      /** Subject path display label for debug regrouping. */
      subjectLabel: string;
    }
  | {
      kind: "aftereffect";
      /** Target tag receiving the emit. */
      tagId: number;
      tagName: string;
      owner: string;
      op: OperationType;
      finishedOnce: number;
      factor: number;
      /** op(finishedOnce, factor) — not op(folded, factor). */
      contribution: number;
      hitCount: number;
      /** contribution × hitCount, merged via is_additive. */
      merged: number;
      before: number;
      after: number;
      layer: Layer | null;
      targetType: TargetType;
      /** True when this write invented isCreatedBase on the owner. */
      invented: boolean;
      sourceLabel: string;
      subjectKey: string;
      subjectLabel: string;
      /** Parent ATM metadata (source subject) for debug display. */
      metadata: string | null;
    }
  | { kind: "special"; label: string; detail: string }
  | {
      kind: "total";
      tagId: number;
      tagName: string;
      total: number;
      /** Same default as merge helpers: missing tag → additive. */
      isAdditive: boolean;
      isPercent: boolean;
    };

export type ApplyInteractionsInput = {
  manifestations: Manifestation[];
  /** Layer A applied manifestations only. */
  appliedManifestations: Manifestation[];
  defaultInteractions: DefaultInteraction[];
  tagsById: Record<number, Tag>;
  /** Awakener id → row for dependency_stat scaling. */
  awakenersById: ReadonlyMap<number, Awakener>;
  /** Awakener id → display name for debug source labels. */
  awakenerNamesById?: ReadonlyMap<number, string>;
  /**
   * Leaf / demand source_type for this calculation path (Option B).
   * When set (including explicitly null), restricted interactions gate on it.
   * Omit only for internal sub-calls that already baked context in.
   */
  leafContext?: SourceType | null;
  /** Final team Max HP for dependency_stat=team_max_hp resolution. */
  teamMaxHp?: number | null;
  /** Team sum of total-base realmMastery for realm rows. */
  realmMasteryTotal?: number;
  /** Team realm resolution for realm pure / combo scaling. */
  teamRealms?: TeamRealmResolution;
  /**
   * sourceKind:id → instance_count × effectiveCopies.
   * Applied after each Layer B subject path at merge (finishedOnce × hitCount).
   * Missing keys (synthetics / transfers) default to 1.
   */
  hitCountByManifestationKey?: ReadonlyMap<string, number>;
};

export type ApplyInteractionsResult = {
  /** Post-interaction team totals by tag id. */
  totalsByTagId: Map<number, number>;
  /** Step-by-step Scalar Sum calculation trace for debug UI. */
  steps: ScalarMathStep[];
};

type MathOpResult = {
  raw: number;
  after: number;
  rounded: boolean;
};

function hitCountForSubject(
  m: Manifestation,
  hitCountByManifestationKey: ReadonlyMap<string, number> | undefined,
): number {
  return hitCountByManifestationKey?.get(manifestationHitCountKey(m)) ?? 1;
}

function formatHitCountDetail(m: Manifestation, hitCount: number): string {
  const copies =
    m.instanceCount !== 0 ? hitCount / m.instanceCount : hitCount;
  const copiesLabel = Number.isInteger(copies)
    ? String(copies)
    : String(copies);
  return `instances ${m.instanceCount} × copies ${copiesLabel}`;
}

function ownerKeyFor(m: Manifestation): OwnerKey {
  if (m.sourceKind === "posse") return "posse";
  if (m.sourceKind === "realm") return REALM_OWNER;
  if (m.awakenerId != null) return `awakener:${m.awakenerId}`;
  return `orphan:${m.sourceKind}:${m.id}`;
}

function sourceLabelFor(
  m: Manifestation,
  awakenerNamesById?: ReadonlyMap<number, string>,
): string {
  if (m.sourceKind === "posse") {
    return m.sourceName ?? "posse";
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

function effectSourcesFromManifests(
  manifests: Manifestation[],
  awakenerNamesById?: ReadonlyMap<number, string>,
): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const m of manifests) {
    const label = sourceLabelFor(m, awakenerNamesById);
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

/** Pass ranks: pre_add=0, add|null=1, post_add=2. */
function layerRank(layer: Layer | null | undefined): number {
  if (layer === "pre_add") return 0;
  if (layer === "post_add") return 2;
  // "add" and null share the additive band.
  return 1;
}

function opTiebreak(op: OperationType): number {
  return op === "add_scaled" ? 0 : 1;
}

/** Null sorts after numbers (posse / realm / created-base often have both null). */
function compareNullLast(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

/**
 * Phase 3c subject order: slotIndex → awakenerId → tagId → sourceKind → id.
 * Null last on slotIndex / awakenerId.
 */
function compareSubjects(a: Manifestation, b: Manifestation): number {
  const slot = compareNullLast(a.slotIndex, b.slotIndex);
  if (slot !== 0) return slot;
  const awakener = compareNullLast(a.awakenerId, b.awakenerId);
  if (awakener !== 0) return awakener;
  if (a.tagId !== b.tagId) return a.tagId - b.tagId;
  if (a.sourceKind !== b.sourceKind) {
    return a.sourceKind < b.sourceKind ? -1 : 1;
  }
  return a.id - b.id;
}

function isCreatesBaseEdge(interaction: DefaultInteraction): boolean {
  return interaction.createsBase && !interaction.amplifiesSubject;
}

/** Invent edges write only the exact target_tag_id (no prefix fan-out). */
function exactCreateTargetTag(
  interaction: DefaultInteraction,
  tagsById: Record<number, Tag>,
): Tag | null {
  if (interaction.targetTagId == null) return null;
  return tagsById[interaction.targetTagId] ?? null;
}

/**
 * Create (invent) → exact target_tag_id.
 * Amplify / other → prefix target + exclusion (tag + descendants).
 */
function targetsForInteraction(
  interaction: DefaultInteraction,
  tagsById: Record<number, Tag>,
): Tag[] {
  if (isCreatesBaseEdge(interaction)) {
    const tag = exactCreateTargetTag(interaction, tagsById);
    return tag ? [tag] : [];
  }
  if (!interaction.targetTagName) return [];
  return matchingTargetTags(
    tagsById,
    interaction.targetTagName,
    interaction.exclusionTagName,
  );
}

/** Aftereffect contribution: op(finishedOnce, factor). `before` is not in the op. */
function aftereffectContribution(
  finishedOnce: number,
  factor: number,
  op: OperationType,
): number {
  if (op === "add_scaled") return finishedOnce + factor;
  return finishedOnce * factor;
}

function aftereffectRowsFor(
  m: Manifestation,
): AwakenerLocalManifestationInteraction[] {
  return m.interactionOverrides
    .filter(
      (row) =>
        row.mode === "aftereffect" &&
        !row.isDisabled &&
        row.targetTagId != null,
    )
    .sort(
      (a, b) =>
        layerRank(a.layer) - layerRank(b.layer) || a.id - b.id,
    );
}

function collectClosure0(applied: Manifestation[]): Set<number> {
  const closure0 = new Set<number>();
  for (const m of applied) {
    for (const row of aftereffectRowsFor(m)) {
      if (row.targetTagId != null) closure0.add(row.targetTagId);
    }
  }
  return closure0;
}

function amplifyTargetIntersectsClosure(
  interaction: DefaultInteraction,
  closure: ReadonlySet<number>,
  tagsById: Record<number, Tag>,
): boolean {
  if (!interaction.targetTagName) return false;
  for (const tag of matchingTargetTags(
    tagsById,
    interaction.targetTagName,
    interaction.exclusionTagName,
  )) {
    if (closure.has(tag.id)) return true;
  }
  return false;
}

type AftereffectClosure = {
  closure0: Set<number>;
  closure: Set<number>;
  deferredCreates: DefaultInteraction[];
  /** Amplifies targeting aftereffect sinks (Increase → Poison/Bleed). */
  deferredStackAmplifies: DefaultInteraction[];
  /** Amplifies targeting created bases (Trigger → Damage). */
  deferredCreateAmplifies: DefaultInteraction[];
};

/**
 * Option A look-ahead: closure0 = aftereffect targets; expand via creates_base
 * (exact modifier match; invent target = exact target_tag_id). Split amplifies:
 * - stack: target intersects closure0 (run on combined stack before create)
 * - create: target intersects closure\closure0 (thin hop on Damage synthetics)
 * Empty closure0 → pull nothing (3b path).
 */
function buildAftereffectClosure(
  applied: Manifestation[],
  defaultInteractions: DefaultInteraction[],
  amplifyRows: DefaultInteraction[],
  tagsById: Record<number, Tag>,
): AftereffectClosure {
  const closure0 = collectClosure0(applied);
  if (closure0.size === 0) {
    return {
      closure0,
      closure: new Set(),
      deferredCreates: [],
      deferredStackAmplifies: [],
      deferredCreateAmplifies: [],
    };
  }

  const closure = new Set(closure0);
  const deferredCreates: DefaultInteraction[] = [];
  const deferredCreateIds = new Set<number>();
  const createEdges = defaultInteractions.filter(isCreatesBaseEdge);

  let grew = true;
  while (grew) {
    grew = false;
    for (const interaction of createEdges) {
      if (interaction.modifierTagId == null) continue;
      if (!closure.has(interaction.modifierTagId)) continue;
      if (!deferredCreateIds.has(interaction.id)) {
        deferredCreateIds.add(interaction.id);
        deferredCreates.push(interaction);
        grew = true;
      }
      const createTargetId = interaction.targetTagId;
      if (createTargetId == null || closure.has(createTargetId)) continue;
      if (tagsById[createTargetId] == null) continue;
      closure.add(createTargetId);
      grew = true;
    }
  }

  const closureCreated = new Set(
    [...closure].filter((id) => !closure0.has(id)),
  );
  const deferredStackAmplifies = amplifyRows.filter((interaction) =>
    amplifyTargetIntersectsClosure(interaction, closure0, tagsById),
  );
  const deferredCreateAmplifies = amplifyRows.filter((interaction) =>
    amplifyTargetIntersectsClosure(interaction, closureCreated, tagsById),
  );

  return {
    closure0,
    closure,
    deferredCreates,
    deferredStackAmplifies,
    deferredCreateAmplifies,
  };
}

function tagNamesForIds(
  ids: Iterable<number>,
  tagsById: Record<number, Tag>,
): string[] {
  return [...ids]
    .map((id) => tagsById[id]?.tagName ?? `#${id}`)
    .sort((a, b) => a.localeCompare(b));
}

function ownerHasLayerATag(
  applied: Manifestation[],
  owner: OwnerKey,
  tagId: number,
): boolean {
  for (const m of applied) {
    if (m.isCreatedBase) continue;
    if (ownerKeyFor(m) === owner && m.tagId === tagId) return true;
  }
  return false;
}

function snapshotCombinedModifier(
  ownerValues: OwnerTotals,
  tag: Tag,
): Manifestation | null {
  const combined = combineTagAcrossOwners(
    ownerValues,
    tag.id,
    tag,
    ownerValues.keys(),
  );
  if (combined === 0) return null;
  return buildCreatedBaseManifestation(tag, combined);
}

/**
 * Per-owner closure0 stack snapshot for deferred stack amplify.
 * Preserves awakener ownership so target_type=self modifiers apply.
 */
function buildOwnerStackSnapshot(
  tag: Tag,
  owner: OwnerKey,
  value: number,
): Manifestation | null {
  if (value === 0) return null;
  const awakenerId = awakenerIdFromOwnerKey(owner);
  const base = buildCreatedBaseManifestation(tag, value);
  if (awakenerId != null) {
    return {
      ...base,
      sourceKind: "awakener",
      awakenerId,
      sourceName: "(aftereffect stack)",
    };
  }
  if (owner === "posse") {
    return { ...base, sourceKind: "posse", sourceName: "(aftereffect stack)" };
  }
  if (owner === REALM_OWNER) {
    return { ...base, sourceKind: "realm", sourceName: "(aftereffect stack)" };
  }
  return { ...base, sourceName: "(aftereffect stack)" };
}

const HOP_4D_FINALIZED_SNAPSHOT_ID_OFFSET = 6_100_000;

function hop4dFinalizedSnapshotId(owner: OwnerKey, tagId: number): number {
  const awakenerId = awakenerIdFromOwnerKey(owner);
  if (awakenerId != null) {
    return -(HOP_4D_FINALIZED_SNAPSHOT_ID_OFFSET + awakenerId * 1000 + tagId);
  }
  if (owner === REALM_OWNER) {
    return -(HOP_4D_FINALIZED_SNAPSHOT_ID_OFFSET + 1_000_000 + tagId);
  }
  if (owner === "posse") {
    return -(HOP_4D_FINALIZED_SNAPSHOT_ID_OFFSET + 2_000_000 + tagId);
  }
  if (owner === TEAM_POOL_OWNER) {
    return -(HOP_4D_FINALIZED_SNAPSHOT_ID_OFFSET + 3_000_000 + tagId);
  }
  return -(HOP_4D_FINALIZED_SNAPSHOT_ID_OFFSET + 4_000_000 + tagId);
}

function finalizedSnapshotTargetType(
  sourceManifestations: readonly Manifestation[],
  owner: OwnerKey,
  tagId: number,
): TargetType {
  let sawOwnerMatch = false;
  for (const m of sourceManifestations) {
    if (m.tagId !== tagId) continue;
    if (ownerKeyFor(m) !== owner) continue;
    sawOwnerMatch = true;
    if (m.targetType === "self") return "self";
  }
  return sawOwnerMatch ? "aoe" : "aoe";
}

function buildHop4dFinalizedSnapshot(
  tag: Tag,
  owner: OwnerKey,
  value: number,
  sourceManifestations: readonly Manifestation[],
): Manifestation | null {
  const snapshot = buildOwnerStackSnapshot(tag, owner, value);
  if (snapshot == null) return null;
  return {
    ...snapshot,
    id: hop4dFinalizedSnapshotId(owner, tag.id),
    sourceName: "(hop 4d finalized)",
    targetType: finalizedSnapshotTargetType(sourceManifestations, owner, tag.id),
  };
}

function tentacleTduPoolManifestationId(owner: OwnerKey): number {
  const awakenerId = awakenerIdFromOwnerKey(owner);
  if (awakenerId != null) return -(TENTACLE_TDU_POOL_ID_OFFSET + 100 + awakenerId);
  if (owner === REALM_OWNER) return -(TENTACLE_TDU_POOL_ID_OFFSET + 1);
  if (owner === "posse") return -(TENTACLE_TDU_POOL_ID_OFFSET + 2);
  return -(TENTACLE_TDU_POOL_ID_OFFSET + 3);
}

function tentaclePoisonFixedManifestationId(owner: OwnerKey): number {
  const awakenerId = awakenerIdFromOwnerKey(owner);
  if (awakenerId != null) {
    return -(TENTACLE_POISON_FIXED_ID_OFFSET + 100 + awakenerId);
  }
  if (owner === REALM_OWNER) return -(TENTACLE_POISON_FIXED_ID_OFFSET + 1);
  if (owner === "posse") return -(TENTACLE_POISON_FIXED_ID_OFFSET + 2);
  return -(TENTACLE_POISON_FIXED_ID_OFFSET + 3);
}

/**
 * Per-owner Tentacle bucket for the default (non-Hit) TDU pool hop.
 * Hits use their own channel synthetics. Other owners keep posse/realm/
 * awakener so ownerKeyFor matches the snapshot bucket.
 */
function buildTentaclePoolSynthetic(
  tag: Tag,
  owner: OwnerKey,
  value: number,
): Manifestation {
  const base = buildCreatedBaseManifestation(tag, value);
  const awakenerId = awakenerIdFromOwnerKey(owner);
  if (awakenerId != null) {
    return {
      ...base,
      id: tentacleTduPoolManifestationId(owner),
      sourceKind: "awakener",
      awakenerId,
      sourceName: TENTACLE_TDU_POOL_SUBJECT_LABEL,
      sourceType: "tentacle",
    };
  }
  if (owner === "posse") {
    return {
      ...base,
      id: tentacleTduPoolManifestationId(owner),
      sourceKind: "posse",
      sourceName: TENTACLE_TDU_POOL_SUBJECT_LABEL,
      sourceType: "tentacle",
    };
  }
  if (owner === REALM_OWNER) {
    return {
      ...base,
      id: tentacleTduPoolManifestationId(owner),
      sourceKind: "realm",
      sourceName: TENTACLE_TDU_POOL_SUBJECT_LABEL,
      sourceType: "tentacle",
    };
  }
  return {
    ...base,
    id: tentacleTduPoolManifestationId(owner),
    sourceName: TENTACLE_TDU_POOL_SUBJECT_LABEL,
    sourceType: "tentacle",
  };
}

function buildTentaclePoisonFixedSynthetic(
  tag: Tag,
  owner: OwnerKey,
  value: number,
): Manifestation {
  const base = buildCreatedBaseManifestation(tag, value);
  const awakenerId = awakenerIdFromOwnerKey(owner);
  if (awakenerId != null) {
    return {
      ...base,
      id: tentaclePoisonFixedManifestationId(owner),
      sourceKind: "awakener",
      awakenerId,
      sourceName: TENTACLE_HIT_POISON_SUBJECT_LABEL,
      sourceType: "tentacle",
      metadata: "Special.Tentacle Hit = Poison",
    };
  }
  if (owner === "posse") {
    return {
      ...base,
      id: tentaclePoisonFixedManifestationId(owner),
      sourceKind: "posse",
      sourceName: TENTACLE_HIT_POISON_SUBJECT_LABEL,
      sourceType: "tentacle",
      metadata: "Special.Tentacle Hit = Poison",
    };
  }
  if (owner === REALM_OWNER) {
    return {
      ...base,
      id: tentaclePoisonFixedManifestationId(owner),
      sourceKind: "realm",
      sourceName: TENTACLE_HIT_POISON_SUBJECT_LABEL,
      sourceType: "tentacle",
      metadata: "Special.Tentacle Hit = Poison",
    };
  }
  return {
    ...base,
    id: tentaclePoisonFixedManifestationId(owner),
    sourceName: TENTACLE_HIT_POISON_SUBJECT_LABEL,
    sourceType: "tentacle",
    metadata: "Special.Tentacle Hit = Poison",
  };
}

function findTagIdByName(
  tagsById: Record<number, Tag>,
  tagName: string,
): number | null {
  for (const tag of Object.values(tagsById)) {
    if (tag.tagName === tagName) return tag.id;
  }
  return null;
}

function getOwnerValue(
  ownerValues: OwnerTotals,
  owner: OwnerKey,
  tagId: number,
): number {
  return ownerValues.get(owner)?.get(tagId) ?? 0;
}

/** True if owner already has this tag in the bucket map (non-zero or explicit key). */
function ownerHasTag(
  ownerValues: OwnerTotals,
  owner: OwnerKey,
  tagId: number,
): boolean {
  const map = ownerValues.get(owner);
  if (!map) return false;
  return (map.get(tagId) ?? 0) !== 0 || map.has(tagId);
}

/** Layer A base-presence for one owner (ignores *team*). */
function isBasePresent(
  base: OwnerTotals,
  owner: OwnerKey,
  tagId: number,
): boolean {
  if (owner === TEAM_POOL_OWNER) return false;
  return ownerHasTag(base, owner, tagId);
}

/**
 * Owners that may receive Attacker/Defender ops: only Layer A base-present.
 * For Support/other targets, use collectOwnersWithTarget (current/next).
 */
function collectBasePresentOwners(
  base: OwnerTotals,
  tagId: number,
): Set<OwnerKey> {
  const owners = new Set<OwnerKey>();
  for (const [owner, map] of base) {
    if (owner === TEAM_POOL_OWNER) continue;
    if ((map.get(tagId) ?? 0) !== 0 || map.has(tagId)) owners.add(owner);
  }
  return owners;
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

function addOwnerValue(
  ownerValues: OwnerTotals,
  owner: OwnerKey,
  tagId: number,
  delta: number,
): void {
  if (delta === 0) return;
  setOwnerValue(
    ownerValues,
    owner,
    tagId,
    getOwnerValue(ownerValues, owner, tagId) + delta,
  );
}

/** Combine same-tag values per tag.is_additive (Layer A seed + post-pass merge). */
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

/** Collapse a tag's values across owners using is_additive (in-pass modifier modValue). */
function combineTagAcrossOwners(
  ownerValues: OwnerTotals,
  tagId: number,
  tag: Tag | undefined,
  owners: Iterable<OwnerKey>,
): number {
  let combined: number | undefined;
  for (const owner of owners) {
    const v = getOwnerValue(ownerValues, owner, tagId);
    if (v === 0) continue;
    combined = combineSameTagScalar(
      combined,
      v,
      tag?.isAdditive !== false,
      tag?.isPercent === true,
    );
  }
  return combined ?? 0;
}

function sumTeamTag(ownerValues: OwnerTotals, tagId: number): number {
  let total = 0;
  for (const map of ownerValues.values()) {
    total += map.get(tagId) ?? 0;
  }
  return total;
}

function cloneOwnerTotals(source: OwnerTotals): OwnerTotals {
  const clone: OwnerTotals = new Map();
  for (const [owner, map] of source) {
    clone.set(owner, new Map(map));
  }
  return clone;
}

function ownerTotalsEqual(a: OwnerTotals, b: OwnerTotals): boolean {
  const owners = new Set([...a.keys(), ...b.keys()]);
  for (const owner of owners) {
    const mapA = a.get(owner) ?? new Map();
    const mapB = b.get(owner) ?? new Map();
    const tagIds = new Set([...mapA.keys(), ...mapB.keys()]);
    for (const tagId of tagIds) {
      if ((mapA.get(tagId) ?? 0) !== (mapB.get(tagId) ?? 0)) return false;
    }
  }
  return true;
}

function roundUpAfterMultiply(
  value: number,
  targetIsPercent: boolean,
): number {
  if (targetIsPercent) return Math.ceil(value * 100) / 100;
  return Math.ceil(value);
}

function applyMathOp(
  targetValue: number,
  modifierValue: number,
  factor: number,
  op: OperationType,
  targetIsPercent: boolean,
): MathOpResult {
  let raw: number;
  switch (op) {
    case "add_scaled":
      raw = targetValue + modifierValue * factor;
      return { raw, after: raw, rounded: false };
    case "presence_multiply":
      raw = targetValue * factor;
      break;
    case "multiply_one_plus": {
      const contribution = modifierValue * factor;
      if (targetIsPercent) {
        raw = (1 + targetValue) * (1 + contribution) - 1;
      } else {
        raw = targetValue * (1 + contribution);
      }
      break;
    }
    case "multiply": {
      const contribution = modifierValue * factor;
      if (targetIsPercent) {
        raw = (1 + targetValue) * contribution - 1;
      } else {
        raw = targetValue * contribution;
      }
      break;
    }
    default: {
      const _exhaustive: never = op;
      return _exhaustive;
    }
  }
  const after = roundUpAfterMultiply(raw, targetIsPercent);
  return { raw, after, rounded: after !== raw };
}

function applyOpAndRecord(
  next: OwnerTotals,
  owner: OwnerKey,
  target: Tag,
  modifierTagName: string,
  modifierValue: number,
  factor: number,
  op: OperationType,
  steps: ScalarMathStep[],
  pass: number,
  modifierTagId: number | null,
  presenceApplied: Set<string>,
  effectSources: string[],
  modifierLayer: Layer | null,
  buffRestrictionMet?: SourceType,
  leafContext?: SourceType | null,
  uniqueScaling?: "patch" | "invent" | "base_stat",
  presenceBandRank?: number,
): void {
  if (op === "presence_multiply" && modifierTagId != null) {
    // Once per (modifier, target tag[, band]) this pass — not per owner bucket.
    const bandSuffix =
      presenceBandRank != null ? `:band${presenceBandRank}` : "";
    const key = `${modifierTagId}:${target.id}${bandSuffix}`;
    if (presenceApplied.has(key)) return;
    presenceApplied.add(key);
  }

  const before = getOwnerValue(next, owner, target.id);
  const result = applyMathOp(
    before,
    modifierValue,
    factor,
    op,
    target.isPercent,
  );
  if (result.after === before) return;
  setOwnerValue(next, owner, target.id, result.after);
  steps.push({
    kind: "op",
    tagId: target.id,
    tagName: target.tagName,
    owner,
    op,
    modifierTagName,
    modifierValue,
    factor,
    before,
    afterRaw: result.raw,
    after: result.after,
    rounded: result.rounded,
    pass,
    effectSources,
    layer: modifierLayer,
    subjectKey: UNSET_SUBJECT_KEY,
    subjectLabel: UNSET_SUBJECT_LABEL,
    ...(buffRestrictionMet != null ? { buffRestrictionMet } : {}),
    ...(leafContext !== undefined ? { leafContext } : {}),
    ...(uniqueScaling != null ? { uniqueScaling } : {}),
  });
}

function isExcluded(
  tagName: string,
  exclusionTagName: string | null,
): boolean {
  if (exclusionTagName == null || exclusionTagName === "") return false;
  return matchesDemandTag(tagName, exclusionTagName);
}

function interactionTargetsTagName(
  interaction: DefaultInteraction,
  tagName: string,
): boolean {
  if (!interaction.targetTagName) return false;
  return matchesDemandTag(tagName, interaction.targetTagName);
}

function matchingTargetTags(
  tagsById: Record<number, Tag>,
  targetTagName: string,
  exclusionTagName: string | null,
): Tag[] {
  const result: Tag[] = [];
  for (const tag of Object.values(tagsById)) {
    if (!matchesDemandTag(tag.tagName, targetTagName)) continue;
    if (isExcluded(tag.tagName, exclusionTagName)) continue;
    result.push(tag);
  }
  return result;
}

/**
 * unique_scaling locals on ATM rows (target manifestation), keyed by
 * incoming modifier_tag_id. Aftereffect rows are skipped here (emitted after
 * the source subject finishes post_add).
 * value_scalar overrides interaction default_factor.
 */
function findTargetOverride(
  appliedManifestations: Manifestation[],
  owner: OwnerKey,
  targetTagId: number,
  modifierTagId: number,
): AwakenerLocalManifestationInteraction | null {
  let found: AwakenerLocalManifestationInteraction | null = null;
  for (const m of appliedManifestations) {
    if (ownerKeyFor(m) !== owner) continue;
    if (m.tagId !== targetTagId) continue;
    for (const override of m.interactionOverrides) {
      if (override.mode !== "unique_scaling") continue;
      if (override.modifierTagId !== modifierTagId) continue;
      if (override.isDisabled) return override;
      found = override;
    }
  }
  return found;
}

/** Local layer wins; null local → modifier tag layer; null-mod base-stat → add. */
function effectiveUniqueScalingLayer(
  local: AwakenerLocalManifestationInteraction,
  tagsById: Record<number, Tag>,
): Layer | null {
  if (local.layer != null) return local.layer;
  if (local.modifierTagId == null) return "add";
  return tagsById[local.modifierTagId]?.layer ?? null;
}

function effectiveInteractionLayerForOwner(
  override: AwakenerLocalManifestationInteraction | null,
  modifierTagLayer: Layer | null,
): Layer | null {
  if (override != null && override.mode === "unique_scaling") {
    if (override.layer != null) return override.layer;
  }
  return modifierTagLayer;
}

function ownerMatchesInteractionBand(
  override: AwakenerLocalManifestationInteraction | null,
  modifierTagLayer: Layer | null,
  bandRank: number,
): boolean {
  return (
    layerRank(effectiveInteractionLayerForOwner(override, modifierTagLayer)) ===
    bandRank
  );
}

function hasMatchingDefaultForUniqueScaling(
  modifierTagId: number,
  targetTagName: string,
  interactions: DefaultInteraction[],
): boolean {
  for (const interaction of interactions) {
    if (interaction.modifierTagId !== modifierTagId) continue;
    if (!interaction.targetTagName) continue;
    if (!matchesDemandTag(targetTagName, interaction.targetTagName)) continue;
    if (isExcluded(targetTagName, interaction.exclusionTagName)) continue;
    return true;
  }
  return false;
}

/** Awakener base-stat as unique_scaling modifierValue (percent deps → percentage points). */
function baseStatUniqueScalingModifierValue(
  awakener: Awakener | null,
  dependencyStat: NonNullable<AwakenerLocalManifestationInteraction["dependencyStat"]>,
): number {
  const raw =
    awakener != null
      ? (awakenerStatForDependency(awakener, dependencyStat) ?? 0)
      : 0;
  if (isPercentDependencyStat(dependencyStat)) {
    // Percentage points; scrub binary float (0.036*100 → 3.5999… → 3.6).
    return Number((raw * 100).toFixed(10));
  }
  return raw;
}

function awakenerIdFromOwnerKey(owner: OwnerKey): number | null {
  const match = /^awakener:(\d+)$/.exec(owner);
  if (!match) return null;
  return Number(match[1]);
}

function resolveOpAndFactor(
  interaction: DefaultInteraction,
  override: AwakenerLocalManifestationInteraction | null,
  ownerAwakener: Awakener | null,
  tagIsPercent = false,
  teamMaxHp?: number | null,
): { op: OperationType; factor: number; disabled: boolean } {
  if (override?.isDisabled) {
    return {
      op: interaction.mathOperation,
      factor: interaction.defaultFactor ?? 0,
      disabled: true,
    };
  }

  const op = override?.mathOperation ?? interaction.mathOperation;
  const factor = effectiveOverrideFactor(
    override,
    interaction.defaultFactor,
    ownerAwakener,
    tagIsPercent,
    teamMaxHp,
  );

  return { op, factor, disabled: false };
}

function effectiveModifierTargetType(
  m: Manifestation,
  modifierTagId: number,
): TargetType | null {
  for (const override of m.interactionOverrides) {
    if (override.modifierTagId !== modifierTagId) continue;
    if (override.targetType != null) return override.targetType;
  }
  return m.targetType;
}

function collectModifierManifestations(
  appliedManifestations: Manifestation[],
  modifierTagId: number,
): Manifestation[] {
  return appliedManifestations.filter((m) => m.tagId === modifierTagId);
}

/** Phase 3b.1 — unique_scaling invent: Modifier Tag matches exact + descendants. */
function collectModifierManifestationsByPrefix(
  appliedManifestations: Manifestation[],
  modifierTagName: string,
): Manifestation[] {
  return appliedManifestations.filter((m) =>
    matchesDemandTag(m.tagName, modifierTagName),
  );
}

function matchingModifierTagIds(
  tagsById: Record<number, Tag>,
  modifierTagName: string,
): number[] {
  const ids: number[] = [];
  for (const tag of Object.values(tagsById)) {
    if (matchesDemandTag(tag.tagName, modifierTagName)) ids.push(tag.id);
  }
  return ids;
}

function sumTeamTagPrefix(
  ownerValues: OwnerTotals,
  tagIds: readonly number[],
): number {
  let total = 0;
  for (const tagId of tagIds) {
    total += sumTeamTag(ownerValues, tagId);
  }
  return total;
}

/**
 * Fold prefix-matched modifier tag totals for the given owners.
 * Per-tag combine uses each tag’s additive/percent; across tags uses root flags.
 */
function combinePrefixModifierValue(
  ownerValues: OwnerTotals,
  matchingTagIds: readonly number[],
  tagsById: Record<number, Tag>,
  rootModifierTag: Tag | undefined,
  owners: Iterable<OwnerKey>,
): number {
  let combined: number | undefined;
  for (const tagId of matchingTagIds) {
    const partial = combineTagAcrossOwners(
      ownerValues,
      tagId,
      tagsById[tagId],
      owners,
    );
    if (partial === 0) continue;
    combined = combineSameTagScalar(
      combined,
      partial,
      rootModifierTag?.isAdditive !== false,
      rootModifierTag?.isPercent === true,
    );
  }
  return combined ?? 0;
}

function collectOwnersWithTarget(
  current: OwnerTotals,
  next: OwnerTotals,
  targetId: number,
): Set<OwnerKey> {
  const ownersWithTarget = new Set<OwnerKey>();
  for (const [owner, map] of next) {
    if (owner === TEAM_POOL_OWNER) continue;
    if ((map.get(targetId) ?? 0) !== 0 || map.has(targetId)) {
      ownersWithTarget.add(owner);
    }
  }
  for (const [owner, map] of current) {
    if (owner === TEAM_POOL_OWNER) continue;
    if (map.has(targetId)) ownersWithTarget.add(owner);
  }
  return ownersWithTarget;
}

/**
 * presence_multiply is boolean presence: for each matched target tag, multiply
 * every existing owner bucket in place by factor. At most once per
 * (modifier, target tag) this pass. Descendants match via prefix unless excluded.
 * Targets that require base-presence: only multiply base-present owner buckets
 * (no *team* amplify — avoids dual-base tracks).
 */
function applyPresenceMultiplyOnce(
  interaction: DefaultInteraction,
  appliedManifestations: Manifestation[],
  base: OwnerTotals,
  current: OwnerTotals,
  next: OwnerTotals,
  targets: Tag[],
  modifierTagId: number,
  modifierTagName: string,
  modifierTagIsPercent: boolean,
  steps: ScalarMathStep[],
  pass: number,
  presenceApplied: Set<string>,
  effectSources: string[],
  awakenersById: ReadonlyMap<number, Awakener>,
  modifierLayer: Layer | null,
  buffRestrictionMet: SourceType | undefined,
  leafContext: SourceType | null | undefined,
  bandRank: number,
  teamMaxHp?: number | null,
): void {
  for (const target of targets) {
    const presenceKey = `${modifierTagId}:${target.id}:band${bandRank}`;
    if (presenceApplied.has(presenceKey)) continue;

    const requireBase = requiresTargetBasePresence(
      interaction,
      target.tagName,
    );
    const ownersWithTarget = requireBase
      ? collectBasePresentOwners(base, target.id)
      : collectOwnersWithTarget(current, next, target.id);

    const ownersInBand = new Set<OwnerKey>();
    for (const owner of ownersWithTarget) {
      const override = findTargetOverride(
        appliedManifestations,
        owner,
        target.id,
        modifierTagId,
      );
      if (!ownerMatchesInteractionBand(override, modifierLayer, bandRank)) {
        continue;
      }
      ownersInBand.add(owner);
    }

    if (requireBase && ownersInBand.size === 0) continue;

    const teamHasTarget =
      !requireBase &&
      (getOwnerValue(next, TEAM_POOL_OWNER, target.id) !== 0 ||
        getOwnerValue(current, TEAM_POOL_OWNER, target.id) !== 0);

    // *team* residual uses modifier tag layer (no local row).
    const teamMatchesBand =
      layerRank(modifierLayer) === bandRank && teamHasTarget;

    if (
      !requireBase &&
      ownersInBand.size === 0 &&
      !teamMatchesBand
    ) {
      continue;
    }

    let factor = interaction.defaultFactor ?? 0;
    let allDisabled = ownersInBand.size > 0;
    let patchKind: "patch" | undefined;

    if (ownersInBand.size === 0) {
      allDisabled = false;
    } else {
      for (const owner of ownersInBand) {
        const override = findTargetOverride(
          appliedManifestations,
          owner,
          target.id,
          modifierTagId,
        );
        if (override?.isDisabled) continue;
        allDisabled = false;
        if (override != null) patchKind = "patch";
        const ownerAwakenerId = awakenerIdFromOwnerKey(owner);
        const ownerAwakener =
          ownerAwakenerId != null
            ? (awakenersById.get(ownerAwakenerId) ?? null)
            : null;
        const resolved = resolveOpAndFactor(
          interaction,
          override,
          ownerAwakener,
          modifierTagIsPercent,
          teamMaxHp,
        );
        factor = resolved.factor;
        break;
      }
    }

    if (allDisabled) continue;

    foldTeamPoolIntoCanonicalOwner(next, base, target.id, requireBase);

    const bucketOwners: OwnerKey[] = [];
    if (requireBase) {
      for (const owner of ownersInBand) {
        const value = getOwnerValue(next, owner, target.id);
        if (value !== 0) bucketOwners.push(owner);
      }
    } else {
      for (const owner of ownersInBand) {
        const value = getOwnerValue(next, owner, target.id);
        if (value != null && value !== 0) bucketOwners.push(owner);
      }
      if (
        teamMatchesBand &&
        getOwnerValue(next, TEAM_POOL_OWNER, target.id) !== 0
      ) {
        bucketOwners.push(TEAM_POOL_OWNER);
      }
    }
    if (bucketOwners.length === 0) continue;

    let combinedBefore = 0;
    for (const owner of bucketOwners) {
      combinedBefore += getOwnerValue(next, owner, target.id);
    }
    if (combinedBefore === 0) continue;

    presenceApplied.add(presenceKey);

    let combinedAfterRaw = 0;
    let combinedAfter = 0;
    let rounded = false;
    for (const owner of bucketOwners) {
      const before = getOwnerValue(next, owner, target.id);
      const result = applyMathOp(
        before,
        1,
        factor,
        "presence_multiply",
        target.isPercent,
      );
      setOwnerValue(next, owner, target.id, result.after);
      combinedAfterRaw += result.raw;
      combinedAfter += result.after;
      if (result.rounded) rounded = true;
    }

    if (combinedAfter === combinedBefore) continue;

    const stepLayer =
      patchKind != null
        ? effectiveInteractionLayerForOwner(
            findTargetOverride(
              appliedManifestations,
              bucketOwners[0]!,
              target.id,
              modifierTagId,
            ),
            modifierLayer,
          )
        : modifierLayer;

    steps.push({
      kind: "op",
      tagId: target.id,
      tagName: target.tagName,
      owner: TEAM_POOL_OWNER,
      op: "presence_multiply",
      modifierTagName,
      modifierValue: 1,
      factor,
      before: combinedBefore,
      afterRaw: combinedAfterRaw,
      after: combinedAfter,
      rounded,
      pass,
      effectSources,
      layer: stepLayer,
      subjectKey: UNSET_SUBJECT_KEY,
      subjectLabel: UNSET_SUBJECT_LABEL,
      ...(buffRestrictionMet != null ? { buffRestrictionMet } : {}),
      ...(leafContext !== undefined ? { leafContext } : {}),
      ...(patchKind != null ? { uniqueScaling: patchKind } : {}),
    });
  }
}

/**
 * If *team* holds a residual for a base-required target, fold into the
 * lexicographically first base-present owner and clear *team*.
 */
function foldTeamPoolIntoCanonicalOwner(
  next: OwnerTotals,
  base: OwnerTotals,
  targetId: number,
  requireBase: boolean,
): void {
  if (!requireBase) return;
  const teamVal = getOwnerValue(next, TEAM_POOL_OWNER, targetId);
  if (teamVal === 0) return;
  const owners = [...collectBasePresentOwners(base, targetId)].sort();
  if (owners.length === 0) {
    setOwnerValue(next, TEAM_POOL_OWNER, targetId, 0);
    return;
  }
  const canonical = owners[0]!;
  addOwnerValue(next, canonical, targetId, teamVal);
  setOwnerValue(next, TEAM_POOL_OWNER, targetId, 0);
}

/**
 * Apply one interaction onto `next`, reading modifier values from `current`
 * and starting target values from `next` (which begins as a clone of base each
 * pass, then accumulates earlier ops in this pass).
 *
 * Phase 2b: if buff_target_type_restriction is set, apply only when leafContext
 * matches; otherwise skip silently (no dual-branch / no debug line).
 *
 * Existence gate: creates_base may invent any target (including Attacker/Defender).
 * Amplify rows require Layer A / created-base presence.
 * Create rows write into *team* (synthetic channel), never into subject owner buckets.
 */
function applyInteractionOnto(
  interaction: DefaultInteraction,
  appliedManifestations: Manifestation[],
  base: OwnerTotals,
  current: OwnerTotals,
  next: OwnerTotals,
  tagsById: Record<number, Tag>,
  steps: ScalarMathStep[],
  pass: number,
  presenceApplied: Set<string>,
  awakenersById: ReadonlyMap<number, Awakener>,
  leafContext: SourceType | null | undefined,
  bandRank: number,
  awakenerNamesById?: ReadonlyMap<number, string>,
  teamMaxHp?: number | null,
): void {
  const modifierTagId = interaction.modifierTagId;
  if (modifierTagId == null) return;

  const targets = targetsForInteraction(interaction, tagsById);
  if (targets.length === 0) return;

  const restriction = interaction.buffTargetTypeRestriction;
  if (restriction != null) {
    // Option B: gate on subject manifestation source_type for this path.
    if (leafContext !== restriction) return;
  }
  const buffRestrictionMet =
    restriction != null ? restriction : undefined;

  const modifierTagName =
    tagsById[modifierTagId]?.tagName ??
    interaction.modifierTagName ??
    `#${modifierTagId}`;
  const modifierTagIsPercent = tagsById[modifierTagId]?.isPercent === true;
  const modifierLayer = tagsById[modifierTagId]?.layer ?? null;

  const modifierManifests = collectModifierManifestations(
    appliedManifestations,
    modifierTagId,
  );
  // Allow chain hops through synthesized Support modifiers (e.g. Fiamma → Final
  // Damage → Active Damage) even when Final Damage has no Layer A manifestation.
  const synthesizedModifierValue = sumTeamTag(current, modifierTagId);
  if (modifierManifests.length === 0 && synthesizedModifierValue === 0) return;

  const effectSources =
    modifierManifests.length > 0
      ? effectSourcesFromManifests(modifierManifests, awakenerNamesById)
      : ["(synthesized)"];

  // Boolean presence: one unified pass, never self+non-self double multiply.
  if (interaction.mathOperation === "presence_multiply") {
    if (modifierManifests.length === 0) return;
    applyPresenceMultiplyOnce(
      interaction,
      appliedManifestations,
      base,
      current,
      next,
      targets,
      modifierTagId,
      modifierTagName,
      modifierTagIsPercent,
      steps,
      pass,
      presenceApplied,
      effectSources,
      awakenersById,
      modifierLayer,
      buffRestrictionMet,
      leafContext,
      bandRank,
      teamMaxHp,
    );
    return;
  }

  const selfOwners = new Set<OwnerKey>();
  let hasNonSelfModifier = false;

  for (const m of modifierManifests) {
    const targetType = effectiveModifierTargetType(m, modifierTagId);
    if (targetType === "self") {
      selfOwners.add(ownerKeyFor(m));
    } else {
      hasNonSelfModifier = true;
    }
  }
  // Synthesized modifier value lives on *team* / owners without a manifestation row.
  if (modifierManifests.length === 0 && synthesizedModifierValue !== 0) {
    hasNonSelfModifier = true;
  }

  for (const owner of selfOwners) {
    const modValue = combineTagAcrossOwners(
      current,
      modifierTagId,
      tagsById[modifierTagId],
      [owner, TEAM_POOL_OWNER],
    );
    const ownerHasModifier = modifierManifests.some(
      (m) => ownerKeyFor(m) === owner,
    );
    const ownerAwakenerId = awakenerIdFromOwnerKey(owner);
    const ownerAwakener =
      ownerAwakenerId != null
        ? (awakenersById.get(ownerAwakenerId) ?? null)
        : null;

    for (const target of targets) {
      const requireBase = requiresTargetBasePresence(
        interaction,
        target.tagName,
      );
      if (requireBase && !isBasePresent(base, owner, target.id)) continue;

      const override = findTargetOverride(
        appliedManifestations,
        owner,
        target.id,
        modifierTagId,
      );
      if (!ownerMatchesInteractionBand(override, modifierLayer, bandRank)) {
        continue;
      }
      const resolved = resolveOpAndFactor(
        interaction,
        override,
        ownerAwakener,
        modifierTagIsPercent,
        teamMaxHp,
      );
      if (resolved.disabled) continue;

      if (resolved.op === "presence_multiply") {
        if (!(modValue !== 0 || ownerHasModifier)) continue;
      }

      const applyLayer = effectiveInteractionLayerForOwner(
        override,
        modifierLayer,
      );
      applyOpAndRecord(
        next,
        owner,
        target,
        modifierTagName,
        resolved.op === "presence_multiply" ? 1 : modValue,
        resolved.factor,
        resolved.op,
        steps,
        pass,
        modifierTagId,
        presenceApplied,
        effectSources,
        applyLayer,
        buffRestrictionMet,
        leafContext,
        override != null ? "patch" : undefined,
        bandRank,
      );
    }
  }

  if (!hasNonSelfModifier) return;

  // Non-self uses only non-self owners' modifier contributions (not self buckets).
  const nonSelfOwners = new Set<OwnerKey>();
  for (const m of modifierManifests) {
    if (effectiveModifierTargetType(m, modifierTagId) === "self") continue;
    nonSelfOwners.add(ownerKeyFor(m));
  }
  const modValue = combineTagAcrossOwners(
    current,
    modifierTagId,
    tagsById[modifierTagId],
    [...nonSelfOwners, TEAM_POOL_OWNER],
  );

  const present = modValue !== 0 || nonSelfOwners.size > 0;

  for (const target of targets) {
    const requireBase = requiresTargetBasePresence(
      interaction,
      target.tagName,
    );
    const ownersWithTarget = requireBase
      ? collectBasePresentOwners(base, target.id)
      : collectOwnersWithTarget(current, next, target.id);

    const ownersInBand = new Set<OwnerKey>();
    for (const owner of ownersWithTarget) {
      const override = findTargetOverride(
        appliedManifestations,
        owner,
        target.id,
        modifierTagId,
      );
      if (!ownerMatchesInteractionBand(override, modifierLayer, bandRank)) {
        continue;
      }
      ownersInBand.add(owner);
    }

    const teamMatchesBand = layerRank(modifierLayer) === bandRank;

    if (requireBase && ownersInBand.size === 0) continue;

    let defaultOp: OperationType = interaction.mathOperation;
    let defaultFactor = interaction.defaultFactor ?? 0;
    let allDisabled = ownersInBand.size > 0;

    if (ownersInBand.size === 0) {
      allDisabled = false;
    } else {
      for (const owner of ownersInBand) {
        const override = findTargetOverride(
          appliedManifestations,
          owner,
          target.id,
          modifierTagId,
        );
        if (override?.isDisabled) continue;
        allDisabled = false;
        const ownerAwakenerId = awakenerIdFromOwnerKey(owner);
        const ownerAwakener =
          ownerAwakenerId != null
            ? (awakenersById.get(ownerAwakenerId) ?? null)
            : null;
        const resolved = resolveOpAndFactor(
          interaction,
          override,
          ownerAwakener,
          modifierTagIsPercent,
          teamMaxHp,
        );
        defaultOp = resolved.op;
        defaultFactor = resolved.factor;
        break;
      }
    }

    if (allDisabled) continue;

    const writeToTeamPool =
      interaction.createsBase && !interaction.amplifiesSubject;

    if (!writeToTeamPool) {
      foldTeamPoolIntoCanonicalOwner(next, base, target.id, requireBase);
    }

    if (defaultOp === "presence_multiply") {
      if (!present) continue;
      if (writeToTeamPool) {
        if (!teamMatchesBand) continue;
        applyOpAndRecord(
          next,
          TEAM_POOL_OWNER,
          target,
          modifierTagName,
          1,
          defaultFactor,
          "presence_multiply",
          steps,
          pass,
          modifierTagId,
          presenceApplied,
          effectSources,
          modifierLayer,
          buffRestrictionMet,
          leafContext,
          undefined,
          bandRank,
        );
        continue;
      }
      for (const owner of ownersInBand) {
        const override = findTargetOverride(
          appliedManifestations,
          owner,
          target.id,
          modifierTagId,
        );
        if (override?.isDisabled) continue;
        const ownerAwakenerId = awakenerIdFromOwnerKey(owner);
        const ownerAwakener =
          ownerAwakenerId != null
            ? (awakenersById.get(ownerAwakenerId) ?? null)
            : null;
        const resolved = resolveOpAndFactor(
          interaction,
          override,
          ownerAwakener,
          modifierTagIsPercent,
          teamMaxHp,
        );
        applyOpAndRecord(
          next,
          owner,
          target,
          modifierTagName,
          1,
          resolved.factor,
          "presence_multiply",
          steps,
          pass,
          modifierTagId,
          presenceApplied,
          effectSources,
          effectiveInteractionLayerForOwner(override, modifierLayer),
          buffRestrictionMet,
          leafContext,
          override != null ? "patch" : undefined,
          bandRank,
        );
      }
      if (
        !requireBase &&
        teamMatchesBand &&
        getOwnerValue(next, TEAM_POOL_OWNER, target.id) !== 0
      ) {
        applyOpAndRecord(
          next,
          TEAM_POOL_OWNER,
          target,
          modifierTagName,
          1,
          defaultFactor,
          "presence_multiply",
          steps,
          pass,
          modifierTagId,
          presenceApplied,
          effectSources,
          modifierLayer,
          buffRestrictionMet,
          leafContext,
          undefined,
          bandRank,
        );
      }
      continue;
    }

    if (defaultOp === "add_scaled") {
      if (writeToTeamPool) {
        if (!teamMatchesBand) continue;
        applyOpAndRecord(
          next,
          TEAM_POOL_OWNER,
          target,
          modifierTagName,
          modValue,
          defaultFactor,
          "add_scaled",
          steps,
          pass,
          modifierTagId,
          presenceApplied,
          effectSources,
          modifierLayer,
          buffRestrictionMet,
          leafContext,
        );
      } else if (ownersInBand.size > 0) {
        for (const owner of ownersInBand) {
          const override = findTargetOverride(
            appliedManifestations,
            owner,
            target.id,
            modifierTagId,
          );
          if (override?.isDisabled) continue;
          const ownerAwakenerId = awakenerIdFromOwnerKey(owner);
          const ownerAwakener =
            ownerAwakenerId != null
              ? (awakenersById.get(ownerAwakenerId) ?? null)
              : null;
          const resolved = resolveOpAndFactor(
            interaction,
            override,
            ownerAwakener,
            modifierTagIsPercent,
            teamMaxHp,
          );
          applyOpAndRecord(
            next,
            owner,
            target,
            modifierTagName,
            modValue,
            resolved.factor,
            "add_scaled",
            steps,
            pass,
            modifierTagId,
            presenceApplied,
            effectSources,
            effectiveInteractionLayerForOwner(override, modifierLayer),
            buffRestrictionMet,
            leafContext,
            override != null ? "patch" : undefined,
          );
        }
      } else if (!requireBase && teamMatchesBand) {
        // Substitute with no base: synthesize once into *team*.
        applyOpAndRecord(
          next,
          TEAM_POOL_OWNER,
          target,
          modifierTagName,
          modValue,
          defaultFactor,
          "add_scaled",
          steps,
          pass,
          modifierTagId,
          presenceApplied,
          effectSources,
          modifierLayer,
          buffRestrictionMet,
          leafContext,
        );
      }
      continue;
    }

    // multiply_one_plus / multiply
    if (writeToTeamPool) {
      if (!teamMatchesBand) continue;
      applyOpAndRecord(
        next,
        TEAM_POOL_OWNER,
        target,
        modifierTagName,
        modValue,
        defaultFactor,
        defaultOp,
        steps,
        pass,
        modifierTagId,
        presenceApplied,
        effectSources,
        modifierLayer,
        buffRestrictionMet,
        leafContext,
      );
    } else if (ownersInBand.size > 0) {
      for (const owner of ownersInBand) {
        const override = findTargetOverride(
          appliedManifestations,
          owner,
          target.id,
          modifierTagId,
        );
        if (override?.isDisabled) continue;
        const ownerAwakenerId = awakenerIdFromOwnerKey(owner);
        const ownerAwakener =
          ownerAwakenerId != null
            ? (awakenersById.get(ownerAwakenerId) ?? null)
            : null;
        const resolved = resolveOpAndFactor(
          interaction,
          override,
          ownerAwakener,
          modifierTagIsPercent,
          teamMaxHp,
        );
        applyOpAndRecord(
          next,
          owner,
          target,
          modifierTagName,
          modValue,
          resolved.factor,
          resolved.op,
          steps,
          pass,
          modifierTagId,
          presenceApplied,
          effectSources,
          effectiveInteractionLayerForOwner(override, modifierLayer),
          buffRestrictionMet,
          leafContext,
          override != null ? "patch" : undefined,
        );
      }
      if (
        !requireBase &&
        teamMatchesBand &&
        getOwnerValue(next, TEAM_POOL_OWNER, target.id) !== 0
      ) {
        applyOpAndRecord(
          next,
          TEAM_POOL_OWNER,
          target,
          modifierTagName,
          modValue,
          defaultFactor,
          defaultOp,
          steps,
          pass,
          modifierTagId,
          presenceApplied,
          effectSources,
          modifierLayer,
          buffRestrictionMet,
          leafContext,
        );
      }
    } else if (!requireBase && teamMatchesBand) {
      applyOpAndRecord(
        next,
        TEAM_POOL_OWNER,
        target,
        modifierTagName,
        modValue,
        defaultFactor,
        defaultOp,
        steps,
        pass,
        modifierTagId,
        presenceApplied,
        effectSources,
        modifierLayer,
        buffRestrictionMet,
        leafContext,
      );
    }
  }
}

function applySpecialConversion(
  ownerValues: OwnerTotals,
  tagsById: Record<number, Tag>,
  appliedManifestations: Manifestation[],
  conversionTagName: string,
  debuffTagName: string,
  damageTagName: string,
  steps: ScalarMathStep[],
): void {
  const hasConversion = appliedManifestations.some(
    (m) => m.tagName === conversionTagName,
  );
  if (!hasConversion) return;

  const debuffId = findTagIdByName(tagsById, debuffTagName);
  const damageId = findTagIdByName(tagsById, damageTagName);
  const activeId = findTagIdByName(tagsById, ACTIVE_DAMAGE);
  const tentacleId = findTagIdByName(tagsById, TENTACLE);
  const nonActiveId = findTagIdByName(tagsById, NON_ACTIVE_DAMAGE);

  if (debuffId == null || damageId == null) return;

  const debuff = sumTeamTag(ownerValues, debuffId);
  if (debuff <= 0) return;

  const active = activeId != null ? sumTeamTag(ownerValues, activeId) : 0;
  const tentacle =
    tentacleId != null ? sumTeamTag(ownerValues, tentacleId) : 0;
  const nonActive =
    nonActiveId != null ? sumTeamTag(ownerValues, nonActiveId) : 0;

  const capacity = Math.max(0, active * 1 + tentacle * 1 + nonActive * 0.5);
  const lost = Math.min(debuff, capacity);
  if (lost <= 0) return;

  const scale = lost / debuff;
  for (const [, map] of ownerValues) {
    const current = map.get(debuffId);
    if (current == null || current === 0) continue;
    map.set(debuffId, current * (1 - scale));
  }

  addOwnerValue(ownerValues, TEAM_POOL_OWNER, damageId, lost * 3);

  steps.push({
    kind: "special",
    label: conversionTagName,
    detail: `${debuffTagName} lost ${lost.toFixed(4)} (capacity ${capacity.toFixed(4)}); +${(lost * 3).toFixed(4)} → ${damageTagName}`,
  });
}

type RunInteractionsOptions = {
  appliedManifestations: Manifestation[];
  defaultInteractions: DefaultInteraction[];
  tagsById: Record<number, Tag>;
  awakenersById: ReadonlyMap<number, Awakener>;
  leafContext: SourceType | null;
  awakenerNamesById?: ReadonlyMap<number, string>;
  /** When false, skip recording base steps (caller already recorded them). */
  recordBaseSteps: boolean;
  /** When false, skip Special conversions (caller runs once after merge). */
  runSpecial: boolean;
  /**
   * Phase 3b — invent unique_scaling with no matching default (subject path).
   * Off for Phase 1 unrestricted creates.
   */
  applyUniqueScalingInvents: boolean;
  /**
   * Defaults used to infer invent vs patch (full rulebook when set).
   * Defaults to `defaultInteractions`.
   */
  uniqueScalingMatchInteractions?: DefaultInteraction[];
  teamMaxHp?: number | null;
  realmMasteryTotal?: number;
  teamRealms?: TeamRealmResolution;
};

type RunInteractionsResult = {
  ownerValues: OwnerTotals;
  steps: ScalarMathStep[];
};

const LAYER_BANDS: Array<Layer | null> = ["pre_add", "add", "post_add"];

/**
 * Phase 3b — invent unique_scaling when no matching tag_default_interaction.
 * Tag-mod and base-stat (null modifier) paths. Aftereffect ignored.
 * Target scope = attached manifestation only.
 */
function applyUniqueScalingInvents(
  appliedManifestations: Manifestation[],
  defaultInteractions: DefaultInteraction[],
  base: OwnerTotals,
  current: OwnerTotals,
  next: OwnerTotals,
  tagsById: Record<number, Tag>,
  steps: ScalarMathStep[],
  pass: number,
  presenceApplied: Set<string>,
  awakenersById: ReadonlyMap<number, Awakener>,
  leafContext: SourceType | null | undefined,
  bandRank: number,
  awakenerNamesById?: ReadonlyMap<number, string>,
  teamMaxHp?: number | null,
): void {
  for (const m of appliedManifestations) {
    if (m.interactionOverrides.length === 0) continue;
    const owner = ownerKeyFor(m);
    const target = tagsById[m.tagId];
    if (!target) continue;
    if (!isBasePresent(base, owner, m.tagId)) continue;

    const ownerAwakener =
      m.awakenerId != null
        ? (awakenersById.get(m.awakenerId) ?? null)
        : null;

    for (const local of m.interactionOverrides) {
      if (local.mode !== "unique_scaling") continue;

      const applyLayer = effectiveUniqueScalingLayer(local, tagsById);
      if (layerRank(applyLayer) !== bandRank) continue;

      // Base-stat invent (null modifier_tag_id)
      if (local.modifierTagId == null) {
        if (local.dependencyStat == null) continue;
        if (local.isDisabled) continue; // no default → no-op

        const modValue = baseStatUniqueScalingModifierValue(
          ownerAwakener,
          local.dependencyStat,
        );
        const factor = local.valueScalar ?? 1;
        const op = local.mathOperation ?? "multiply_one_plus";
        const modLabel = `base_stat:${local.dependencyStat}`;

        applyOpAndRecord(
          next,
          owner,
          target,
          modLabel,
          modValue,
          factor,
          op,
          steps,
          pass,
          null,
          presenceApplied,
          [sourceLabelFor(m, awakenerNamesById)],
          applyLayer,
          undefined,
          leafContext,
          "base_stat",
          bandRank,
        );
        continue;
      }

      // Tag-mod: invent only when no matching default (else patch path).
      if (
        hasMatchingDefaultForUniqueScaling(
          local.modifierTagId,
          m.tagName,
          defaultInteractions,
        )
      ) {
        continue;
      }
      if (local.isDisabled) continue; // no default + disabled → no-op

      const modifierTagId = local.modifierTagId;
      const modifierTag = tagsById[modifierTagId];
      const modifierTagName =
        modifierTag?.tagName ?? local.modifierTagName ?? `#${modifierTagId}`;
      const modifierTagIsPercent = modifierTag?.isPercent === true;

      const matchingTagIds = matchingModifierTagIds(
        tagsById,
        modifierTagName,
      );
      const modifierManifests = collectModifierManifestationsByPrefix(
        appliedManifestations,
        modifierTagName,
      );
      const synthesizedModifierValue = sumTeamTagPrefix(
        current,
        matchingTagIds,
      );
      if (modifierManifests.length === 0 && synthesizedModifierValue === 0) {
        continue;
      }

      const effectSources =
        modifierManifests.length > 0
          ? effectSourcesFromManifests(modifierManifests, awakenerNamesById)
          : ["(synthesized)"];

      const selfOwners = new Set<OwnerKey>();
      let hasNonSelfModifier = false;
      for (const modM of modifierManifests) {
        // Per-row tag id so modifier-ATM overrides key off that manifestation’s tag.
        const targetType = effectiveModifierTargetType(modM, modM.tagId);
        if (targetType === "self") {
          selfOwners.add(ownerKeyFor(modM));
        } else {
          hasNonSelfModifier = true;
        }
      }
      if (modifierManifests.length === 0 && synthesizedModifierValue !== 0) {
        hasNonSelfModifier = true;
      }

      let modValue = 0;
      if (selfOwners.has(owner)) {
        modValue = combinePrefixModifierValue(
          current,
          matchingTagIds,
          tagsById,
          modifierTag,
          [owner, TEAM_POOL_OWNER],
        );
      } else if (hasNonSelfModifier) {
        const nonSelfOwners = new Set<OwnerKey>();
        for (const modM of modifierManifests) {
          if (effectiveModifierTargetType(modM, modM.tagId) === "self") {
            continue;
          }
          nonSelfOwners.add(ownerKeyFor(modM));
        }
        modValue = combinePrefixModifierValue(
          current,
          matchingTagIds,
          tagsById,
          modifierTag,
          [...nonSelfOwners, TEAM_POOL_OWNER],
        );
      } else {
        continue;
      }

      const op = local.mathOperation ?? "multiply_one_plus";
      const factor = effectiveOverrideFactor(
        local,
        1,
        ownerAwakener,
        modifierTagIsPercent,
        teamMaxHp,
      );

      applyOpAndRecord(
        next,
        owner,
        target,
        modifierTagName,
        op === "presence_multiply" ? 1 : modValue,
        factor,
        op,
        steps,
        pass,
        modifierTagId,
        presenceApplied,
        effectSources,
        applyLayer,
        undefined,
        leafContext,
        "invent",
        bandRank,
      );
    }
  }
}

function scalarOptionsFrom(
  partial: Pick<
    EffectiveScalarOptions,
    "teamMaxHp" | "realmMasteryTotal" | "teamRealms"
  >,
): EffectiveScalarOptions {
  return {
    teamMaxHp: partial.teamMaxHp,
    realmMasteryTotal: partial.realmMasteryTotal,
    teamRealms: partial.teamRealms,
  };
}

/**
 * Cohort for subject M: all applied manifests except same-tagId siblings, plus M.
 */
function cohortForSubject(
  applied: Manifestation[],
  subject: Manifestation,
): Manifestation[] {
  return applied.filter(
    (m) =>
      (m.sourceKind === subject.sourceKind && m.id === subject.id) ||
      m.tagId !== subject.tagId,
  );
}

/**
 * Single-path interaction run for one subject leafContext (Option B).
 * Uses dependency-scaled effective scalars for base contributions and overrides.
 */
function runInteractionsForLeafContext(
  options: RunInteractionsOptions,
): RunInteractionsResult {
  const steps: ScalarMathStep[] = [];
  const base: OwnerTotals = new Map();

  for (const m of options.appliedManifestations) {
    const raw = m.valueScalar ?? 0;
    const scalar = effectiveManifestationScalar(
      m,
      options.awakenersById,
      options.tagsById,
      scalarOptionsFrom(options),
    );
    if (scalar === 0 && raw === 0) continue;
    if (scalar === 0) continue;
    mergeOwnerValue(
      base,
      ownerKeyFor(m),
      options.tagsById[m.tagId],
      m.tagId,
      scalar,
    );
    if (options.recordBaseSteps) {
      const sourceLabel = sourceLabelFor(m, options.awakenerNamesById);
      steps.push({
        kind: "base",
        tagId: m.tagId,
        tagName: m.tagName,
        owner: ownerKeyFor(m),
        scalar,
        rawScalar: raw,
        sourceLabel,
        subjectKey: manifestationHitCountKey(m),
        subjectLabel: sourceLabel,
        metadata: m.metadata,
      });
    }
  }

  const interactionsInIdOpOrder = [...options.defaultInteractions]
    .filter((interaction) => interaction.modifierTagId != null)
    .sort(
      (a, b) =>
        opTiebreak(a.mathOperation) - opTiebreak(b.mathOperation) ||
        a.id - b.id,
    );

  let current = cloneOwnerTotals(base);
  let lastPassOpSteps: ScalarMathStep[] = [];

  for (let pass = 0; pass < INTERACTION_MAX_PASSES; pass++) {
    const next = cloneOwnerTotals(base);
    const passOpSteps: ScalarMathStep[] = [];
    const presenceApplied = new Set<string>();

    for (const band of LAYER_BANDS) {
      const bandRank = layerRank(band);
      for (const interaction of interactionsInIdOpOrder) {
        applyInteractionOnto(
          interaction,
          options.appliedManifestations,
          base,
          current,
          next,
          options.tagsById,
          passOpSteps,
          pass,
          presenceApplied,
          options.awakenersById,
          options.leafContext,
          bandRank,
          options.awakenerNamesById,
          options.teamMaxHp,
        );
      }
      if (options.applyUniqueScalingInvents) {
        applyUniqueScalingInvents(
          options.appliedManifestations,
          options.uniqueScalingMatchInteractions ??
            options.defaultInteractions,
          base,
          current,
          next,
          options.tagsById,
          passOpSteps,
          pass,
          presenceApplied,
          options.awakenersById,
          options.leafContext,
          bandRank,
          options.awakenerNamesById,
          options.teamMaxHp,
        );
      }
    }

    lastPassOpSteps = passOpSteps;

    if (ownerTotalsEqual(next, current)) {
      current = next;
      break;
    }
    current = next;
  }

  steps.push(...lastPassOpSteps);

  if (options.runSpecial) {
    applySpecialConversion(
      current,
      options.tagsById,
      options.appliedManifestations,
      SPECIAL_CORROSION_CONVERSION,
      DEBUFF_CORROSION,
      CORROSION_DAMAGE,
      steps,
    );
    applySpecialConversion(
      current,
      options.tagsById,
      options.appliedManifestations,
      SPECIAL_EMBERS_CONVERSION,
      DEBUFF_EMBERS,
      EMBERS_DAMAGE,
      steps,
    );
  }

  return { ownerValues: current, steps };
}

function sumOwnerTotalsToTagMap(
  ownerValues: OwnerTotals,
  tagsById: Record<number, Tag>,
): Map<number, number> {
  const totalsByTagId = new Map<number, number>();
  for (const map of ownerValues.values()) {
    for (const [tagId, value] of map) {
      if (value === 0) continue;
      const tag = tagsById[tagId];
      const current = totalsByTagId.get(tagId);
      totalsByTagId.set(
        tagId,
        combineSameTagScalar(
          current,
          value,
          tag?.isAdditive !== false,
          tag?.isPercent === true,
        ),
      );
    }
  }
  return totalsByTagId;
}

/**
 * Stable negative id for creates_base synthetics (avoids collision with base-stat transfers).
 */
export function createdBaseManifestationId(tagId: number): number {
  return -(900_000 + tagId);
}

function buildCreatedBaseManifestation(
  tag: Tag,
  value: number,
): Manifestation {
  return {
    id: createdBaseManifestationId(tag.id),
    sourceKind: "posse",
    awakenerId: null,
    slotIndex: null,
    sourceName: "(created base)",
    tagId: tag.id,
    tagName: tag.tagName,
    triggerCondition: null,
    valueScalar: value,
    ...DEFAULT_COPY_INSTANCE_FIELDS,
    dependencyStat: null,
    sourceType: null,
    targetType: "aoe",
    buffTargetTypeRestriction: null,
    metadata: null,
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

/** Exact target_tag_id set for creates_base materialization (no prefix). */
function collectExactCreateTargetIds(
  interactions: DefaultInteraction[],
): Set<number> {
  const ids = new Set<number>();
  for (const interaction of interactions) {
    if (interaction.targetTagId != null) ids.add(interaction.targetTagId);
  }
  return ids;
}

/** Prefix-expanded targets for amplify bookkeeping. */
function collectAmplifyTargetIds(
  interactions: DefaultInteraction[],
  tagsById: Record<number, Tag>,
): Set<number> {
  const ids = new Set<number>();
  for (const interaction of interactions) {
    if (interaction.targetTagId != null) {
      ids.add(interaction.targetTagId);
    }
    for (const tag of Object.values(tagsById)) {
      if (
        interaction.targetTagName &&
        matchesDemandTag(tag.tagName, interaction.targetTagName) &&
        !isExcluded(tag.tagName, interaction.exclusionTagName)
      ) {
        ids.add(tag.id);
      }
    }
  }
  return ids;
}

/**
 * Layer B — apply tag_default_interaction (+ unique_scaling / aftereffect) and
 * Special conversions.
 *
 * Matching: exact modifier; creates_base invent = exact target_tag_id;
 * amplifies_subject = prefix target + exclusion (tag + descendants).
 * Self-scope: modifier target_type=self only updates same-owner tags.
 * Pass order (Phase 2c): modifier tag.layer — pre_add → add/null → post_add;
 * within rank add_scaled then other ops then id.
 *
 * Pipeline (Phase 3c + stack amplify):
 * 0. Look-ahead: closure0 = aftereffect targets; expand via creates_base
 *    (exact modifier; invent exact target_tag_id); pull those creates; split amplifies into
 *    closure0 (stack) vs closure\\closure0 (create/Trigger).
 *    Empty closure0 → pull nothing (3b path).
 * 1. Other unrestricted creates_base (excluding pulled closure edges).
 * 2. Shared owner totals (aftereffect sinks + deferred create/amplify).
 * 3. Each subject (slotIndex → awakenerId → tagId → sourceKind → id; null last):
 *    finish single-hit → aftereffect from finishedOnce (merge × hitCount) →
 *    own-tag finishedOnce × hitCount. unique_scaling stays in-band.
 * 4a. Deferred stack amplify on combined per-owner closure0 totals
 *    (Increase → Poison/Bleed); replace owner totals.
 * 4b. Deferred thin create (combined stack, *team* OK).
 * 4c. Deferred thin amplify on created synthetics (Trigger → Damage;
 *    leafContext = synthetic sourceType null). Not a subject loop.
 * 4d. Tentacle TDU pool: default Attacker.Tentacle (RTM, Generate) ×
 *    (Unique TDU + TDU + TDU.Fixed) from finalized owner totals; Hit channels
 *    ceil(hits×factor×pool) separately (realm Hit summed; each non-realm Hit
 *    row own channel). Then × (1 + Tentacle Crit Damage) (multiply_one_plus).
 *    Skip TDU-family TDI on Tentacle subjects; remaining Tentacle TDI
 *    (Vulnerability) runs on post-crit pooled synthetics against finalized
 *    non-Tentacle snapshots, then merge. Tentacle Crit Rate is display-only.
 *    Before Corrosion.
 * 5. Special conversions last inside Layer B.
 *
 * Phase 2b.1: isBaseStatTransfer / realm / Support isCreatedBase subjects contribute
 * absolute scalar only (no inbound ops) but remain in other subjects' cohorts as modifiers.
 * Exception: Base Tentacle Damage synthetic (realm-sourced) receives inbound amplify.
 * is_additive: Layer A same-tag seed + in-pass modifier collapse, and post-pass
 * subject merge (sum vs multiply; percent multiplicative uses (1+v) fold-back).
 */
export function applyInteractions(
  input: ApplyInteractionsInput,
): ApplyInteractionsResult {
  const awakenersById = input.awakenersById;
  const applied = input.appliedManifestations;
  const steps: ScalarMathStep[] = [];
  const scalarOpts = scalarOptionsFrom(input);

  // Record every applied manifestation's base once (raw vs effective).
  for (const m of applied) {
    const raw = m.valueScalar ?? 0;
    const scalar = effectiveManifestationScalar(
      m,
      awakenersById,
      input.tagsById,
      scalarOpts,
    );
    if (scalar === 0) continue;
    const sourceLabel = sourceLabelFor(m, input.awakenerNamesById);
    steps.push({
      kind: "base",
      tagId: m.tagId,
      tagName: m.tagName,
      owner: ownerKeyFor(m),
      scalar,
      rawScalar: raw,
      sourceLabel,
      subjectKey: manifestationHitCountKey(m),
      subjectLabel: sourceLabel,
      metadata: m.metadata,
    });
  }

  // XOR filters: create = createsBase && !amplifiesSubject; amplify = amplifiesSubject && !createsBase.
  // Both-true → amplify only; both-false → neither.
  const unrestrictedCreates = input.defaultInteractions.filter(
    (i) =>
      i.createsBase &&
      !i.amplifiesSubject &&
      i.buffTargetTypeRestriction == null,
  );
  const restrictedCreates = input.defaultInteractions.filter(
    (i) =>
      i.createsBase &&
      !i.amplifiesSubject &&
      i.buffTargetTypeRestriction != null,
  );
  const amplifyInteractions = input.defaultInteractions.filter(
    (i) => i.amplifiesSubject && !i.createsBase,
  );
  // Both-true soft-warned rows: treat as amplify (require invent off via createsBase still true —
  // prefer invent-off: include with createsBase forced conceptually by requiring base).
  // Include both-true as amplify with createsBase left as-is only if we strip invent:
  const bothTrueAmplify = input.defaultInteractions.filter(
    (i) => i.amplifiesSubject && i.createsBase,
  );
  const amplifyRows =
    bothTrueAmplify.length === 0
      ? amplifyInteractions
      : [
          ...amplifyInteractions,
          ...bothTrueAmplify.map((i) => ({ ...i, createsBase: false })),
        ];

  const lookAhead = buildAftereffectClosure(
    applied,
    input.defaultInteractions,
    amplifyRows,
    input.tagsById,
  );
  const deferredCreateIds = new Set(
    lookAhead.deferredCreates.map((i) => i.id),
  );
  const deferredAmplifyIds = new Set([
    ...lookAhead.deferredStackAmplifies.map((i) => i.id),
    ...lookAhead.deferredCreateAmplifies.map((i) => i.id),
  ]);
  const unrestrictedCreatesLive = unrestrictedCreates.filter(
    (i) => !deferredCreateIds.has(i.id),
  );
  const restrictedCreatesLive = restrictedCreates.filter(
    (i) => !deferredCreateIds.has(i.id),
  );
  const amplifyRowsLive = amplifyRows.filter(
    (i) => !deferredAmplifyIds.has(i.id),
  );

  if (lookAhead.closure0.size > 0) {
    const closure0Names = tagNamesForIds(
      lookAhead.closure0,
      input.tagsById,
    );
    const closureNames = tagNamesForIds(lookAhead.closure, input.tagsById);
    steps.push({
      kind: "special",
      label: "look-ahead closure",
      detail: `closure0={${closure0Names.join(", ")}}; closure={${closureNames.join(", ")}}`,
    });
  }

  const mergedOwnerValues: OwnerTotals = new Map();
  const opSteps: ScalarMathStep[] = [];
  const aftereffectSteps: ScalarMathStep[] = [];
  const createdSynthetics: Manifestation[] = [];

  // Phase 1 — unrestricted materialize into *team*, emit synthetics
  // (excluding creates_base edges pulled into the deferred hop).
  if (unrestrictedCreatesLive.length > 0 && applied.length > 0) {
    const createResult = runInteractionsForLeafContext({
      appliedManifestations: applied,
      defaultInteractions: unrestrictedCreatesLive,
      tagsById: input.tagsById,
      awakenersById,
      leafContext: null,
      awakenerNamesById: input.awakenerNamesById,
      recordBaseSteps: false,
      runSpecial: false,
      applyUniqueScalingInvents: false,
      teamMaxHp: input.teamMaxHp,
      realmMasteryTotal: input.realmMasteryTotal,
      teamRealms: input.teamRealms,
    });

    const createTargetIds = collectExactCreateTargetIds(
      unrestrictedCreatesLive,
    );

    for (const tagId of createTargetIds) {
      const teamVal = getOwnerValue(
        createResult.ownerValues,
        TEAM_POOL_OWNER,
        tagId,
      );
      if (teamVal === 0) continue;
      const tag = input.tagsById[tagId];
      if (!tag) continue;

      const synthetic = buildCreatedBaseManifestation(tag, teamVal);
      createdSynthetics.push(synthetic);

      if (isAttackerOrDefenderTag(tag.tagName)) {
        // Attacker/Defender created bases become Phase 2 subjects (merged there).
      } else {
        // Support created bases: merge absolute into totals now (immune subjects).
        mergeOwnerValue(
          mergedOwnerValues,
          ownerKeyFor(synthetic),
          tag,
          tagId,
          teamVal,
        );
      }
    }

    for (const step of createResult.steps) {
      if (step.kind !== "op") continue;
      if (createTargetIds.has(step.tagId)) {
        opSteps.push({
          ...step,
          subjectKey: PHASE1_CREATE_SUBJECT_KEY,
          subjectLabel: PHASE1_CREATE_SUBJECT_LABEL,
        });
      }
    }
  }

  const phase2Applied = [...applied, ...createdSynthetics];

  const subjects = phase2Applied
    .filter((m) => {
      const scalar = effectiveManifestationScalar(
        m,
        awakenersById,
        input.tagsById,
        scalarOpts,
      );
      return scalar !== 0;
    })
    .sort(compareSubjects);

  const hitCountByKey = input.hitCountByManifestationKey;
  const hitCountSteps: ScalarMathStep[] = [];

  const emitAftereffects = (
    subject: Manifestation,
    finishedOnce: number,
    hitCount: number,
    sourceLabel: string,
    subjectKey: string,
  ) => {
    const writeOwner = ownerKeyFor(subject);
    const ownerAwakener =
      subject.awakenerId != null
        ? (awakenersById.get(subject.awakenerId) ?? null)
        : null;

    for (const row of aftereffectRowsFor(subject)) {
      const targetId = row.targetTagId;
      if (targetId == null) continue;
      const target = input.tagsById[targetId];
      if (!target) continue;

      const factor = effectiveOverrideFactor(
        row,
        1,
        ownerAwakener,
        target.isPercent,
        input.teamMaxHp,
      );
      const op = row.mathOperation ?? "multiply";
      const contribution = aftereffectContribution(finishedOnce, factor, op);
      const merged = contribution * hitCount;
      if (merged === 0) continue;

      const alreadyHas =
        ownerHasTag(mergedOwnerValues, writeOwner, targetId) ||
        ownerHasLayerATag(applied, writeOwner, targetId);
      const invented = !alreadyHas;
      const before = getOwnerValue(mergedOwnerValues, writeOwner, targetId);

      mergeOwnerValue(
        mergedOwnerValues,
        writeOwner,
        target,
        targetId,
        merged,
      );

      aftereffectSteps.push({
        kind: "aftereffect",
        tagId: targetId,
        tagName: target.tagName,
        owner: writeOwner,
        op,
        finishedOnce,
        factor,
        contribution,
        hitCount,
        merged,
        before,
        after: getOwnerValue(mergedOwnerValues, writeOwner, targetId),
        layer: row.layer,
        targetType: row.targetType,
        invented,
        sourceLabel,
        subjectKey,
        subjectLabel: sourceLabel,
        metadata: subject.metadata,
      });
    }
  };

  if (subjects.length > 0) {
    for (const subject of subjects) {
      const hitCount = hitCountForSubject(subject, hitCountByKey);
      const owner = ownerKeyFor(subject);
      const tag = input.tagsById[subject.tagId];
      const sourceLabel = sourceLabelFor(subject, input.awakenerNamesById);

      const subjectKey = manifestationHitCountKey(subject);

      const pushHitCountStep = (finishedOnce: number) => {
        if (hitCount === 1 || finishedOnce === 0) return;
        hitCountSteps.push({
          kind: "hitCount",
          tagId: subject.tagId,
          tagName: subject.tagName,
          owner,
          sourceLabel,
          finishedOnce,
          hitCount,
          after: finishedOnce * hitCount,
          detail: formatHitCountDetail(subject, hitCount),
          subjectKey,
          subjectLabel: sourceLabel,
        });
      };

      // Immune: absolute scalar only (Support created bases already merged in Phase 1).
      if (isInteractionImmuneSubject(subject)) {
        if (subject.isCreatedBase) continue;
        const scalar = effectiveManifestationScalar(
          subject,
          awakenersById,
          input.tagsById,
          scalarOpts,
        );
        emitAftereffects(subject, scalar, hitCount, sourceLabel, subjectKey);
        if (scalar !== 0) {
          mergeOwnerValue(
            mergedOwnerValues,
            owner,
            tag,
            subject.tagId,
            scalar * hitCount,
          );
          pushHitCountStep(scalar);
        }
        continue;
      }

      const cohort = cohortForSubject(phase2Applied, subject);
      const tentacleAmplifyLive =
        subject.tagId === ATTACKER_TENTACLE_TAG_ID
          ? amplifyRowsLive.filter(
              (i) => !isHitTentacleSkipModifier(i.modifierTagId),
            )
          : amplifyRowsLive;
      const subjectInteractions = [
        ...restrictedCreatesLive,
        ...tentacleAmplifyLive,
      ];
      const result = runInteractionsForLeafContext({
        appliedManifestations: cohort,
        defaultInteractions: subjectInteractions,
        tagsById: input.tagsById,
        awakenersById,
        leafContext: subject.sourceType,
        awakenerNamesById: input.awakenerNamesById,
        recordBaseSteps: false,
        runSpecial: false,
        applyUniqueScalingInvents: true,
        uniqueScalingMatchInteractions: input.defaultInteractions,
        teamMaxHp: input.teamMaxHp,
        realmMasteryTotal: input.realmMasteryTotal,
        teamRealms: input.teamRealms,
      });

      const finishedOnce = getOwnerValue(
        result.ownerValues,
        owner,
        subject.tagId,
      );

      for (const step of result.steps) {
        if (step.kind !== "op") continue;
        if (
          step.tagId === subject.tagId ||
          step.buffRestrictionMet != null
        ) {
          opSteps.push({
            ...step,
            subjectKey,
            subjectLabel: sourceLabel,
          });
        }
      }

      emitAftereffects(
        subject,
        finishedOnce,
        hitCount,
        sourceLabel,
        subjectKey,
      );

      if (finishedOnce !== 0) {
        mergeOwnerValue(
          mergedOwnerValues,
          owner,
          tag,
          subject.tagId,
          finishedOnce * hitCount,
        );
        pushHitCountStep(finishedOnce);
      }
    }
  }

  const deferredSynthetics: Manifestation[] = [];

  // 4a — Deferred stack amplify on combined per-owner closure0 totals
  // (Increase → Poison/Bleed) before create snapshots the stack.
  if (lookAhead.deferredStackAmplifies.length > 0) {
    const stackSnapshots: Manifestation[] = [];
    const snapshotKeys: Array<{ owner: OwnerKey; tagId: number }> = [];
    for (const [owner, tagMap] of mergedOwnerValues) {
      for (const tagId of lookAhead.closure0) {
        const value = tagMap.get(tagId) ?? 0;
        if (value === 0) continue;
        const tag = input.tagsById[tagId];
        if (!tag) continue;
        const snapshot = buildOwnerStackSnapshot(tag, owner, value);
        if (snapshot == null) continue;
        stackSnapshots.push(snapshot);
        snapshotKeys.push({ owner, tagId });
      }
    }

    if (stackSnapshots.length > 0) {
      const thinApplied = [
        ...applied.filter((m) => !lookAhead.closure0.has(m.tagId)),
        ...stackSnapshots,
      ];
      const amplifyResult = runInteractionsForLeafContext({
        appliedManifestations: thinApplied,
        defaultInteractions: lookAhead.deferredStackAmplifies,
        tagsById: input.tagsById,
        awakenersById,
        leafContext: null,
        awakenerNamesById: input.awakenerNamesById,
        recordBaseSteps: false,
        runSpecial: false,
        applyUniqueScalingInvents: false,
        teamMaxHp: input.teamMaxHp,
        realmMasteryTotal: input.realmMasteryTotal,
        teamRealms: input.teamRealms,
      });

      const amplifyTargetIds = collectAmplifyTargetIds(
        lookAhead.deferredStackAmplifies,
        input.tagsById,
      );
      for (const step of amplifyResult.steps) {
        if (step.kind !== "op") continue;
        if (amplifyTargetIds.has(step.tagId)) {
          opSteps.push({
            ...step,
            subjectKey: DEFERRED_STACK_AMPLIFY_SUBJECT_KEY,
            subjectLabel: DEFERRED_STACK_AMPLIFY_SUBJECT_LABEL,
            leafContext: null,
          });
        }
      }

      for (const { owner, tagId } of snapshotKeys) {
        setOwnerValue(
          mergedOwnerValues,
          owner,
          tagId,
          getOwnerValue(amplifyResult.ownerValues, owner, tagId),
        );
      }
    }
  }

  // 4b — Deferred Option A thin create from (amplified) combined closure0 stacks.
  if (lookAhead.deferredCreates.length > 0) {
    const modifierTagIds = new Set<number>();
    for (const interaction of lookAhead.deferredCreates) {
      if (interaction.modifierTagId != null) {
        modifierTagIds.add(interaction.modifierTagId);
      }
    }
    const snapshots: Manifestation[] = [];
    for (const tagId of modifierTagIds) {
      const tag = input.tagsById[tagId];
      if (!tag) continue;
      const snapshot = snapshotCombinedModifier(mergedOwnerValues, tag);
      if (snapshot != null) snapshots.push(snapshot);
    }

    if (snapshots.length > 0) {
      const createResult = runInteractionsForLeafContext({
        appliedManifestations: snapshots,
        defaultInteractions: lookAhead.deferredCreates,
        tagsById: input.tagsById,
        awakenersById,
        leafContext: null,
        awakenerNamesById: input.awakenerNamesById,
        recordBaseSteps: false,
        runSpecial: false,
        applyUniqueScalingInvents: false,
        teamMaxHp: input.teamMaxHp,
        realmMasteryTotal: input.realmMasteryTotal,
        teamRealms: input.teamRealms,
      });

      const createTargetIds = collectExactCreateTargetIds(
        lookAhead.deferredCreates,
      );

      for (const tagId of createTargetIds) {
        const teamVal = getOwnerValue(
          createResult.ownerValues,
          TEAM_POOL_OWNER,
          tagId,
        );
        if (teamVal === 0) continue;
        const tag = input.tagsById[tagId];
        if (!tag) continue;
        deferredSynthetics.push(buildCreatedBaseManifestation(tag, teamVal));
      }

      for (const step of createResult.steps) {
        if (step.kind !== "op") continue;
        if (createTargetIds.has(step.tagId)) {
          opSteps.push({
            ...step,
            subjectKey: DEFERRED_CREATE_SUBJECT_KEY,
            subjectLabel: DEFERRED_CREATE_SUBJECT_LABEL,
          });
        }
      }
    }
  }

  // 4c — Deferred thin amplify on created synthetics (Trigger → Damage).
  if (
    deferredSynthetics.length > 0 &&
    lookAhead.deferredCreateAmplifies.length > 0
  ) {
    const thinApplied = [
      ...applied.filter((m) => !lookAhead.closure0.has(m.tagId)),
      ...deferredSynthetics,
    ];
    const amplifyResult = runInteractionsForLeafContext({
      appliedManifestations: thinApplied,
      defaultInteractions: lookAhead.deferredCreateAmplifies,
      tagsById: input.tagsById,
      awakenersById,
      leafContext: null,
      awakenerNamesById: input.awakenerNamesById,
      recordBaseSteps: false,
      runSpecial: false,
      applyUniqueScalingInvents: false,
      teamMaxHp: input.teamMaxHp,
      realmMasteryTotal: input.realmMasteryTotal,
      teamRealms: input.teamRealms,
    });

    const amplifyTargetIds = collectAmplifyTargetIds(
      lookAhead.deferredCreateAmplifies,
      input.tagsById,
    );
    for (const step of amplifyResult.steps) {
      if (step.kind !== "op") continue;
      if (amplifyTargetIds.has(step.tagId)) {
        opSteps.push({
          ...step,
          subjectKey: DEFERRED_AMPLIFY_SUBJECT_KEY,
          subjectLabel: DEFERRED_AMPLIFY_SUBJECT_LABEL,
          leafContext: null,
        });
      }
    }

    for (const synthetic of deferredSynthetics) {
      const tag = input.tagsById[synthetic.tagId];
      const value = getOwnerValue(
        amplifyResult.ownerValues,
        ownerKeyFor(synthetic),
        synthetic.tagId,
      );
      if (value === 0) continue;
      mergeOwnerValue(
        mergedOwnerValues,
        ownerKeyFor(synthetic),
        tag,
        synthetic.tagId,
        value,
      );
    }
  } else {
    for (const synthetic of deferredSynthetics) {
      const tag = input.tagsById[synthetic.tagId];
      const scalar = synthetic.valueScalar ?? 0;
      if (scalar === 0) continue;
      mergeOwnerValue(
        mergedOwnerValues,
        ownerKeyFor(synthetic),
        tag,
        synthetic.tagId,
        scalar,
      );
    }
  }

  const hitTentacleSteps: ScalarMathStep[] = [];
  const hitSynthetics = buildHitTentacleSynthetics(
    applied,
    awakenersById,
    input.tagsById,
    hitCountByKey,
    scalarOpts,
  );
  const tentacleTag = input.tagsById[ATTACKER_TENTACLE_TAG_ID];
  const tentacleUnits = new Map<OwnerKey, number>();
  if (tentacleTag != null) {
    for (const [owner, map] of mergedOwnerValues) {
      if (owner === TEAM_POOL_OWNER) continue;
      const units = map.get(tentacleTag.id) ?? 0;
      if (units !== 0) tentacleUnits.set(owner, units);
    }
  }
  const prePoolTentacleBuckets = collectPrePoolTentacleAttackBuckets(
    mergedOwnerValues,
    hitSynthetics,
  );

  if (
    tentacleTag != null &&
    (tentacleUnits.size > 0 || hitSynthetics.length > 0)
  ) {
    const tentacle = tentacleTag;
    const tentacleAmplify = amplifyRows.filter(
      (i) =>
        interactionTargetsTagName(i, TENTACLE) &&
        !isHitTentacleSkipModifier(i.modifierTagId),
    );

    // Layer B subject loop has already finalized TDU-family totals (incl.
    // unique_scaling and TDU-prefix amplifies). Do not rebuild from a warmup
    // snapshot — that path skipped unique_scaling and dropped Fixed TDU.
    const tentaclePoolApplied = [
      ...applied,
      ...createdSynthetics,
      ...deferredSynthetics,
    ];
    const tentacleCritInput = {
      awakeners: [...awakenersById.values()],
      appliedManifestations: tentaclePoolApplied,
      awakenersById,
      tagsById: input.tagsById,
      scalarOpts,
    };
    const tentacleCritDamage = computeTentacleCritDamage(tentacleCritInput);
    const tentacleCritRate = computeTentacleCritRate(tentacleCritInput);
    const tduOwnerValues = mergedOwnerValues;
    const finalizedModifierSnapshots: Manifestation[] = [];
    for (const [owner, tagMap] of mergedOwnerValues) {
      for (const [tagId, value] of tagMap) {
        if (tagId === ATTACKER_TENTACLE_TAG_ID || value === 0) continue;
        const tag = input.tagsById[tagId];
        if (!tag) continue;
        const snapshot = buildHop4dFinalizedSnapshot(
          tag,
          owner,
          value,
          tentaclePoolApplied,
        );
        if (snapshot != null) finalizedModifierSnapshots.push(snapshot);
      }
    }

    const detailParts: string[] = [];
    const hitDetailParts: string[] = [];
    const poisonDetailParts: string[] = [];

    const emitTentacleProduct = (
      owner: OwnerKey,
      productSynthetic: Manifestation,
      before: number,
      factor: number,
      pool: number,
      product: number,
      subjectLabel: string,
      write: "set" | "merge",
    ): void => {
      const sourceLabel = sourceLabelFor(
        productSynthetic,
        input.awakenerNamesById,
      );
      const subjectKey = manifestationHitCountKey(productSynthetic);
      hitTentacleSteps.push({
        kind: "base",
        tagId: tentacle.id,
        tagName: tentacle.tagName,
        owner,
        scalar: before,
        rawScalar: before,
        sourceLabel,
        subjectKey,
        subjectLabel,
        metadata: productSynthetic.metadata,
      });
      const pushPoolOp = (
        modifierTagName: string,
        modifierValue: number,
        opBefore: number,
        afterRaw: number,
        after: number,
      ): void => {
        if (after === opBefore && afterRaw === opBefore) return;
        hitTentacleSteps.push({
          kind: "op",
          tagId: tentacle.id,
          tagName: tentacle.tagName,
          owner,
          op: "multiply",
          modifierTagName,
          modifierValue,
          factor: 1,
          before: opBefore,
          afterRaw,
          after,
          rounded: after !== afterRaw,
          pass: 0,
          effectSources: [subjectLabel],
          layer: "add",
          leafContext: "tentacle",
          subjectKey,
          subjectLabel,
        });
      };
      if (product !== before) {
        const tduAfterRaw = before * pool;
        if (factor === 1) {
          pushPoolOp(
            TENTACLE_TDU_FAMILY_POOL_LABEL,
            pool,
            before,
            tduAfterRaw,
            product,
          );
        } else {
          pushPoolOp(
            TENTACLE_TDU_FAMILY_POOL_LABEL,
            pool,
            before,
            tduAfterRaw,
            tduAfterRaw,
          );
          pushPoolOp(
            SPECIAL_HIT_TENTACLE_ATTACK,
            factor,
            tduAfterRaw,
            tduAfterRaw * factor,
            product,
          );
        }
      }

      let afterCrit = product;
      let critSynthetic = productSynthetic;
      if (product !== 0 && tentacleCritDamage.total > 0) {
        const critAfterRaw = product * (1 + tentacleCritDamage.total);
        afterCrit = Math.ceil(critAfterRaw - 1e-10);
        hitTentacleSteps.push({
          kind: "op",
          tagId: tentacle.id,
          tagName: tentacle.tagName,
          owner,
          op: "multiply_one_plus",
          modifierTagName: TENTACLE_CRIT_DAMAGE_LABEL,
          modifierValue: tentacleCritDamage.total,
          factor: 1,
          before: product,
          afterRaw: critAfterRaw,
          after: afterCrit,
          rounded: afterCrit !== critAfterRaw,
          pass: 0,
          effectSources: [subjectLabel],
          layer: "add",
          leafContext: "tentacle",
          subjectKey,
          subjectLabel,
        });
        if (afterCrit !== product) {
          critSynthetic = { ...productSynthetic, valueScalar: afterCrit };
        }
      }

      let finished = afterCrit;
      if (afterCrit !== 0 && tentacleAmplify.length > 0) {
        const cohort = cohortForSubject(
          [...finalizedModifierSnapshots, critSynthetic],
          critSynthetic,
        );
        const amplifyResult = runInteractionsForLeafContext({
          appliedManifestations: cohort,
          defaultInteractions: tentacleAmplify,
          tagsById: input.tagsById,
          awakenersById,
          leafContext: "tentacle",
          awakenerNamesById: input.awakenerNamesById,
          recordBaseSteps: false,
          runSpecial: false,
          applyUniqueScalingInvents: true,
          uniqueScalingMatchInteractions: input.defaultInteractions,
          teamMaxHp: input.teamMaxHp,
          realmMasteryTotal: input.realmMasteryTotal,
          teamRealms: input.teamRealms,
        });
        finished = getOwnerValue(
          amplifyResult.ownerValues,
          owner,
          productSynthetic.tagId,
        );
        for (const step of amplifyResult.steps) {
          if (step.kind !== "op") continue;
          if (step.tagId !== productSynthetic.tagId) continue;
          hitTentacleSteps.push({
            ...step,
            subjectKey,
            subjectLabel,
            leafContext: "tentacle",
          });
        }
      }

      if (write === "set") {
        setOwnerValue(mergedOwnerValues, owner, tentacle.id, finished);
      } else if (finished !== 0) {
        mergeOwnerValue(
          mergedOwnerValues,
          owner,
          tentacle,
          tentacle.id,
          finished,
        );
      }
    };

    const poisonFixedTag = input.tagsById[ATTACKER_POISON_FIXED_TAG_ID];
    const poisonFixedAmplify = amplifyRows.filter((i) =>
      interactionTargetsTagName(i, ATTACKER_POISON_FIXED),
    );
    if (
      poisonFixedTag != null &&
      input.tagsById[SPECIAL_TENTACLE_HIT_POISON_TAG_ID] != null &&
      prePoolTentacleBuckets.length > 0
    ) {
      const attacksByOwner = new Map<OwnerKey, number>();
      const ownerBucketDetails = new Map<OwnerKey, string[]>();
      for (const bucket of prePoolTentacleBuckets) {
        attacksByOwner.set(
          bucket.owner,
          (attacksByOwner.get(bucket.owner) ?? 0) + bucket.attacks,
        );
        const label =
          bucket.kind === "existing_tentacle"
            ? `existing=${bucket.attacks}`
            : `hit:${bucket.channelLabel}=${bucket.attacks}`;
        const details = ownerBucketDetails.get(bucket.owner) ?? [];
        details.push(label);
        ownerBucketDetails.set(bucket.owner, details);
      }

      for (const owner of [...attacksByOwner.keys()].sort()) {
        const attacks = attacksByOwner.get(owner) ?? 0;
        if (attacks === 0) continue;
        const factor = combineTentacleHitPoisonScalarForOwner(
          applied,
          owner,
          awakenersById,
          input.tagsById,
          scalarOpts,
        );
        if (factor === 0) continue;
        const product = attacks * factor;
        if (product === 0) continue;
        const productSynthetic = buildTentaclePoisonFixedSynthetic(
          poisonFixedTag,
          owner,
          product,
        );
        const sourceLabel = sourceLabelFor(
          productSynthetic,
          input.awakenerNamesById,
        );
        const subjectKey = manifestationHitCountKey(productSynthetic);
        hitTentacleSteps.push({
          kind: "base",
          tagId: poisonFixedTag.id,
          tagName: poisonFixedTag.tagName,
          owner,
          scalar: product,
          rawScalar: product,
          sourceLabel,
          subjectKey,
          subjectLabel: TENTACLE_HIT_POISON_SUBJECT_LABEL,
          metadata: productSynthetic.metadata,
        });
        hitTentacleSteps.push({
          kind: "op",
          tagId: poisonFixedTag.id,
          tagName: poisonFixedTag.tagName,
          owner,
          op: "multiply",
          modifierTagName: SPECIAL_TENTACLE_HIT_POISON,
          modifierValue: factor,
          factor: 1,
          before: attacks,
          afterRaw: product,
          after: product,
          rounded: false,
          pass: 0,
          effectSources: [TENTACLE_HIT_POISON_SUBJECT_LABEL],
          layer: "add",
          leafContext: "tentacle",
          subjectKey,
          subjectLabel: TENTACLE_HIT_POISON_SUBJECT_LABEL,
        });

        let finished = product;
        if (poisonFixedAmplify.length > 0) {
          const cohort = cohortForSubject(
            [...finalizedModifierSnapshots, productSynthetic],
            productSynthetic,
          );
          const amplifyResult = runInteractionsForLeafContext({
            appliedManifestations: cohort,
            defaultInteractions: poisonFixedAmplify,
            tagsById: input.tagsById,
            awakenersById,
            leafContext: "tentacle",
            awakenerNamesById: input.awakenerNamesById,
            recordBaseSteps: false,
            runSpecial: false,
            applyUniqueScalingInvents: true,
            uniqueScalingMatchInteractions: input.defaultInteractions,
            teamMaxHp: input.teamMaxHp,
            realmMasteryTotal: input.realmMasteryTotal,
            teamRealms: input.teamRealms,
          });
          finished = getOwnerValue(
            amplifyResult.ownerValues,
            owner,
            productSynthetic.tagId,
          );
          for (const step of amplifyResult.steps) {
            if (step.kind !== "op") continue;
            if (step.tagId !== productSynthetic.tagId) continue;
            hitTentacleSteps.push({
              ...step,
              subjectKey,
              subjectLabel: TENTACLE_HIT_POISON_SUBJECT_LABEL,
              leafContext: "tentacle",
            });
          }
        }

        mergeOwnerValue(
          mergedOwnerValues,
          owner,
          poisonFixedTag,
          poisonFixedTag.id,
          finished,
        );
        poisonDetailParts.push(
          `${owner} attacks=${attacks} factor=${factor} product=${product}` +
            ` buckets=[${(ownerBucketDetails.get(owner) ?? []).join(", ")}]` +
            (finished !== product ? ` finished=${finished}` : ""),
        );
      }
    }

    for (const owner of [...tentacleUnits.keys()].sort()) {
      const units = tentacleUnits.get(owner) ?? 0;
      if (units === 0) continue;
      const poolBreakdown = combineTduFamilyPoolBreakdown(
        tduOwnerValues,
        tentaclePoolApplied,
        owner,
        input.tagsById,
      );
      const pool = poolBreakdown.total;
      const product = computeHitTentacleProduct(units, 1, pool);
      const productSynthetic = buildTentaclePoolSynthetic(
        tentacle,
        owner,
        product,
      );
      detailParts.push(
        `${owner} units=${units} pool=${pool}` +
          ` (Unique=${poolBreakdown.unique}+TDU=${poolBreakdown.tdu}+Fixed=${poolBreakdown.fixed})` +
          ` product=${product}`,
      );
      emitTentacleProduct(
        owner,
        productSynthetic,
        units,
        1,
        pool,
        product,
        TENTACLE_TDU_POOL_SUBJECT_LABEL,
        "set",
      );
    }

    for (const hit of hitSynthetics) {
      const owner = ownerKeyFor(hit.manifestation);
      const poolBreakdown = combineTduFamilyPoolBreakdown(
        tduOwnerValues,
        tentaclePoolApplied,
        owner,
        input.tagsById,
      );
      const pool = poolBreakdown.total;
      const product = computeHitTentacleProduct(hit.hits, hit.factor, pool);
      const productSynthetic = {
        ...hit.manifestation,
        valueScalar: product,
      };
      const hitLine =
        `${owner} channel=${hit.channelLabel} hits=${hit.hits}` +
        ` attacks=${hit.attacks} factor=${hit.factor}` +
        ` pool=${pool} (Unique=${poolBreakdown.unique}+TDU=${poolBreakdown.tdu}+Fixed=${poolBreakdown.fixed})` +
        ` product=${product}`;
      detailParts.push(hitLine);
      hitDetailParts.push(hitLine);
      emitTentacleProduct(
        owner,
        productSynthetic,
        hit.hits,
        hit.factor,
        pool,
        product,
        HIT_TENTACLE_SUBJECT_LABEL,
        "merge",
      );
    }

    if (detailParts.length > 0) {
      hitTentacleSteps.push({
        kind: "special",
        label: TENTACLE_TDU_POOL_SUBJECT_LABEL,
        detail: detailParts.join("; "),
      });
    }
    if (hitDetailParts.length > 0) {
      hitTentacleSteps.push({
        kind: "special",
        label: "Special.Hit = Tentacle Attack",
        detail: hitDetailParts.join("; "),
      });
    }
    if (poisonDetailParts.length > 0) {
      hitTentacleSteps.push({
        kind: "special",
        label: SPECIAL_TENTACLE_HIT_POISON,
        detail: poisonDetailParts.join("; "),
      });
    }
    hitTentacleSteps.push({
      kind: "special",
      label: TENTACLE_CRIT_RATE_LABEL,
      detail: formatTentacleCritDetail(tentacleCritRate),
    });
    hitTentacleSteps.push({
      kind: "special",
      label: TENTACLE_CRIT_DAMAGE_LABEL,
      detail: formatTentacleCritDetail(tentacleCritDamage),
    });
  }

  steps.push(
    ...opSteps,
    ...aftereffectSteps,
    ...hitCountSteps,
    ...hitTentacleSteps,
  );

  const phase2AppliedForSpecial = [
    ...phase2Applied,
    ...deferredSynthetics,
    ...hitSynthetics.map((h) => h.manifestation),
  ];

  // Special conversions once on merged totals (all applied + created for presence).
  applySpecialConversion(
    mergedOwnerValues,
    input.tagsById,
    phase2AppliedForSpecial,
    SPECIAL_CORROSION_CONVERSION,
    DEBUFF_CORROSION,
    CORROSION_DAMAGE,
    steps,
  );
  applySpecialConversion(
    mergedOwnerValues,
    input.tagsById,
    phase2AppliedForSpecial,
    SPECIAL_EMBERS_CONVERSION,
    DEBUFF_EMBERS,
    EMBERS_DAMAGE,
    steps,
  );

  const totalsByTagId = sumOwnerTotalsToTagMap(
    mergedOwnerValues,
    input.tagsById,
  );

  for (const [tagId, total] of totalsByTagId) {
    const tag = input.tagsById[tagId];
    steps.push({
      kind: "total",
      tagId,
      tagName: tag?.tagName ?? `#${tagId}`,
      total,
      isAdditive: tag?.isAdditive !== false,
      isPercent: tag?.isPercent === true,
    });
  }

  return { totalsByTagId, steps };
}

export function applyInteractionsForTeamData(
  teamData: TeamData,
  appliedManifestations: Manifestation[],
  teamMaxHp?: number | null,
  teamRealms?: TeamRealmResolution,
  hitCountByManifestationKey?: ReadonlyMap<string, number>,
): ApplyInteractionsResult {
  const awakenerNamesById = new Map<number, string>();
  for (const awakener of teamData.awakeners) {
    awakenerNamesById.set(
      awakener.id,
      awakener.name ?? `#${awakener.id}`,
    );
  }
  return applyInteractions({
    manifestations: teamData.manifestations,
    appliedManifestations,
    defaultInteractions: teamData.defaultInteractions,
    tagsById: teamData.tagsById,
    awakenersById: buildAwakenersById(teamData.awakeners),
    awakenerNamesById,
    teamMaxHp,
    realmMasteryTotal: sumTeamRealmMastery(teamData.awakeners),
    teamRealms,
    hitCountByManifestationKey,
  });
}
