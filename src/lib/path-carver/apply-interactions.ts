import {
  buildAwakenersById,
  effectiveManifestationScalar,
  effectiveOverrideFactor,
  isInteractionImmuneSubject,
  sumTeamRealmMastery,
  type EffectiveScalarOptions,
} from "@/lib/path-carver/effective-value-scalar";
import { combineSameTagScalar } from "@/lib/path-carver/combine-same-tag-scalar";
import { matchesDemandTag } from "@/lib/simulator/tag-matching";
import type { TeamRealmResolution } from "@/lib/team-data/resolve-team-realms";
import {
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

/** Existence-gated sinks: interactions must not invent these without Layer A base. */
export function isAttackerOrDefenderTag(tagName: string): boolean {
  return (
    tagName.startsWith("Attacker.") || tagName.startsWith("Defender.")
  );
}

/**
 * Amplify rows require Layer A / created-base presence.
 * Create rows (createsBase) may invent Support and Attacker/Defender sinks.
 */
export function requiresTargetBasePresence(
  interaction: DefaultInteraction,
  _targetTagName: string,
): boolean {
  return !interaction.createsBase;
}

const TEAM_POOL_OWNER = "*team*";
const REALM_OWNER = "realm";

const SPECIAL_CORROSION_CONVERSION = "Special.Corrosion Conversion";
const SPECIAL_EMBERS_CONVERSION = "Special.Ancient Embers Conversion";
const DEBUFF_CORROSION = "Support.Debuff.Corrosion";
const DEBUFF_EMBERS = "Support.Debuff.Ancient Embers";
const ACTIVE_DAMAGE = "Attacker.Active Damage";
const TENTACLE = "Attacker.Tentacle";
const NON_ACTIVE_DAMAGE = "Attacker.Non-Active Damage";
const CORROSION_DAMAGE = "Attacker.Corrosion Damage";
const EMBERS_DAMAGE = "Attacker.Ancient Embers Damage";

type OwnerKey = string;
type OwnerTotals = Map<OwnerKey, Map<number, number>>;

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
      /** Modifier tag layer that drove pass order (Phase 2c). */
      layer: Layer | null;
    }
  | { kind: "special"; label: string; detail: string }
  | { kind: "total"; tagId: number; tagName: string; total: number };

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

/**
 * Sort by modifier tag layer, then add_scaled before other ops, then id.
 * Override math_operation does not affect this order (uses default row op).
 */
function orderInteractionsByModifierLayer(
  interactions: DefaultInteraction[],
  tagsById: Record<number, Tag>,
): DefaultInteraction[] {
  return [...interactions]
    .filter((interaction) => interaction.modifierTagId != null)
    .sort((a, b) => {
      const layerA =
        a.modifierTagId != null
          ? (tagsById[a.modifierTagId]?.layer ?? null)
          : null;
      const layerB =
        b.modifierTagId != null
          ? (tagsById[b.modifierTagId]?.layer ?? null)
          : null;
      return (
        layerRank(layerA) - layerRank(layerB) ||
        opTiebreak(a.mathOperation) - opTiebreak(b.mathOperation) ||
        a.id - b.id
      );
    });
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
): void {
  if (op === "presence_multiply" && modifierTagId != null) {
    // Once per (modifier, target tag) this pass — not per owner bucket.
    const key = `${modifierTagId}:${target.id}`;
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
    ...(buffRestrictionMet != null ? { buffRestrictionMet } : {}),
    ...(leafContext !== undefined ? { leafContext } : {}),
  });
}

function isExcluded(
  tagName: string,
  exclusionTagName: string | null,
): boolean {
  if (exclusionTagName == null || exclusionTagName === "") return false;
  return matchesDemandTag(tagName, exclusionTagName);
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
 * Overrides live on ATM rows (typically the target manifestation), keyed by
 * incoming modifier_tag_id. value_scalar overrides interaction default_factor.
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
      if (override.modifierTagId !== modifierTagId) continue;
      if (override.isDisabled) return override;
      found = override;
    }
  }
  return found;
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
  teamMaxHp?: number | null,
): void {
  for (const target of targets) {
    const presenceKey = `${modifierTagId}:${target.id}`;
    if (presenceApplied.has(presenceKey)) continue;

    const requireBase = requiresTargetBasePresence(
      interaction,
      target.tagName,
    );
    const ownersWithTarget = requireBase
      ? collectBasePresentOwners(base, target.id)
      : collectOwnersWithTarget(current, next, target.id);

    if (requireBase && ownersWithTarget.size === 0) continue;

    const teamHasTarget =
      !requireBase &&
      (getOwnerValue(next, TEAM_POOL_OWNER, target.id) !== 0 ||
        getOwnerValue(current, TEAM_POOL_OWNER, target.id) !== 0);

    if (
      !requireBase &&
      ownersWithTarget.size === 0 &&
      !teamHasTarget
    ) {
      continue;
    }

    let factor = interaction.defaultFactor ?? 0;
    let allDisabled = ownersWithTarget.size > 0;

    if (ownersWithTarget.size === 0) {
      allDisabled = false;
    } else {
      for (const owner of ownersWithTarget) {
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
        factor = resolved.factor;
        break;
      }
    }

    if (allDisabled) continue;

    foldTeamPoolIntoCanonicalOwner(next, base, target.id, requireBase);

    const bucketOwners: OwnerKey[] = [];
    if (requireBase) {
      for (const owner of ownersWithTarget) {
        const value = getOwnerValue(next, owner, target.id);
        if (value !== 0) bucketOwners.push(owner);
      }
    } else {
      for (const [owner, map] of next) {
        const value = map.get(target.id);
        if (value != null && value !== 0) bucketOwners.push(owner);
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
      layer: modifierLayer,
      ...(buffRestrictionMet != null ? { buffRestrictionMet } : {}),
      ...(leafContext !== undefined ? { leafContext } : {}),
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
  awakenerNamesById?: ReadonlyMap<number, string>,
  teamMaxHp?: number | null,
): void {
  const modifierTagId = interaction.modifierTagId;
  const targetTagName = interaction.targetTagName;
  if (modifierTagId == null || !targetTagName) return;

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

  const targets = matchingTargetTags(
    tagsById,
    targetTagName,
    interaction.exclusionTagName,
  );
  if (targets.length === 0) return;

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
        modifierLayer,
        buffRestrictionMet,
        leafContext,
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

    if (requireBase && ownersWithTarget.size === 0) continue;

    let defaultOp: OperationType = interaction.mathOperation;
    let defaultFactor = interaction.defaultFactor ?? 0;
    let allDisabled = ownersWithTarget.size > 0;

    if (ownersWithTarget.size === 0) {
      allDisabled = false;
    } else {
      for (const owner of ownersWithTarget) {
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
        );
        continue;
      }
      for (const owner of ownersWithTarget) {
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
          modifierLayer,
          buffRestrictionMet,
          leafContext,
        );
      }
      if (
        !requireBase &&
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
        );
      }
      continue;
    }

    if (defaultOp === "add_scaled") {
      if (writeToTeamPool) {
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
      } else if (ownersWithTarget.size > 0) {
        for (const owner of ownersWithTarget) {
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
            modifierLayer,
            buffRestrictionMet,
            leafContext,
          );
        }
      } else if (!requireBase) {
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
    } else if (ownersWithTarget.size > 0) {
      for (const owner of ownersWithTarget) {
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
          modifierLayer,
          buffRestrictionMet,
          leafContext,
        );
      }
      if (
        !requireBase &&
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
    } else if (!requireBase) {
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
  teamMaxHp?: number | null;
  realmMasteryTotal?: number;
  teamRealms?: TeamRealmResolution;
};

type RunInteractionsResult = {
  ownerValues: OwnerTotals;
  steps: ScalarMathStep[];
};

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
      steps.push({
        kind: "base",
        tagId: m.tagId,
        tagName: m.tagName,
        owner: ownerKeyFor(m),
        scalar,
        rawScalar: raw,
        sourceLabel: sourceLabelFor(m, options.awakenerNamesById),
      });
    }
  }

  const orderedInteractions = orderInteractionsByModifierLayer(
    options.defaultInteractions,
    options.tagsById,
  );

  let current = cloneOwnerTotals(base);
  let lastPassOpSteps: ScalarMathStep[] = [];

  for (let pass = 0; pass < INTERACTION_MAX_PASSES; pass++) {
    const next = cloneOwnerTotals(base);
    const passOpSteps: ScalarMathStep[] = [];
    const presenceApplied = new Set<string>();

    for (const interaction of orderedInteractions) {
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
        options.awakenerNamesById,
        options.teamMaxHp,
      );
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
    baseHits: null,
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

function collectInteractionTargetIds(
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
 * Layer B — apply tag_default_interaction (+ overrides) and Special conversions.
 *
 * Matching: exact modifier, prefix target, exclusion = tag + descendants.
 * Self-scope: modifier target_type=self only updates same-owner tags.
 * Pass order (Phase 2c): modifier tag.layer — pre_add → add/null → post_add;
 * within rank add_scaled then other ops then id.
 *
 * Pipeline:
 * 1. Phase 1 — unrestricted creates_base: materialize into *team*, emit synthetics.
 *    Support created bases merge into totals (immune subjects); Attacker/Defender
 *    created bases become Phase 2 subjects.
 * 2. Phase 2 — per subject: restricted creates_base as scoped seed, then
 *    amplifies_subject only. leafContext = subject.sourceType.
 * 3. Special conversions once on merged totals (after all layer passes).
 *
 * Phase 2b.1: isBaseStatTransfer / realm / Support isCreatedBase subjects contribute
 * absolute scalar only (no inbound ops) but remain in other subjects' cohorts as modifiers.
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
    steps.push({
      kind: "base",
      tagId: m.tagId,
      tagName: m.tagName,
      owner: ownerKeyFor(m),
      scalar,
      rawScalar: raw,
      sourceLabel: sourceLabelFor(m, input.awakenerNamesById),
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

  const mergedOwnerValues: OwnerTotals = new Map();
  const opSteps: ScalarMathStep[] = [];
  const createdSynthetics: Manifestation[] = [];

  // Phase 1 — unrestricted materialize into *team*, emit synthetics.
  if (unrestrictedCreates.length > 0 && applied.length > 0) {
    const createResult = runInteractionsForLeafContext({
      appliedManifestations: applied,
      defaultInteractions: unrestrictedCreates,
      tagsById: input.tagsById,
      awakenersById,
      leafContext: null,
      awakenerNamesById: input.awakenerNamesById,
      recordBaseSteps: false,
      runSpecial: false,
      teamMaxHp: input.teamMaxHp,
      realmMasteryTotal: input.realmMasteryTotal,
      teamRealms: input.teamRealms,
    });

    const createTargetIds = collectInteractionTargetIds(
      unrestrictedCreates,
      input.tagsById,
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
        opSteps.push(step);
      }
    }
  }

  const phase2Applied = [...applied, ...createdSynthetics];

  const subjects = phase2Applied.filter((m) => {
    const scalar = effectiveManifestationScalar(
      m,
      awakenersById,
      input.tagsById,
      scalarOpts,
    );
    return scalar !== 0;
  });

  if (subjects.length > 0) {
    for (const subject of subjects) {
      // Immune: absolute scalar only (Support created bases already merged in Phase 1).
      if (isInteractionImmuneSubject(subject)) {
        if (subject.isCreatedBase) continue;
        const scalar = effectiveManifestationScalar(
          subject,
          awakenersById,
          input.tagsById,
          scalarOpts,
        );
        if (scalar !== 0) {
          mergeOwnerValue(
            mergedOwnerValues,
            ownerKeyFor(subject),
            input.tagsById[subject.tagId],
            subject.tagId,
            scalar,
          );
        }
        continue;
      }

      const cohort = cohortForSubject(phase2Applied, subject);
      const subjectInteractions = [...restrictedCreates, ...amplifyRows];
      const result = runInteractionsForLeafContext({
        appliedManifestations: cohort,
        defaultInteractions: subjectInteractions,
        tagsById: input.tagsById,
        awakenersById,
        leafContext: subject.sourceType,
        awakenerNamesById: input.awakenerNamesById,
        recordBaseSteps: false,
        runSpecial: false,
        teamMaxHp: input.teamMaxHp,
        realmMasteryTotal: input.realmMasteryTotal,
        teamRealms: input.teamRealms,
      });

      const owner = ownerKeyFor(subject);
      const value = getOwnerValue(result.ownerValues, owner, subject.tagId);
      if (value !== 0) {
        mergeOwnerValue(
          mergedOwnerValues,
          owner,
          input.tagsById[subject.tagId],
          subject.tagId,
          value,
        );
      }

      for (const step of result.steps) {
        if (step.kind !== "op") continue;
        if (
          step.tagId === subject.tagId ||
          step.buffRestrictionMet != null
        ) {
          opSteps.push(step);
        }
      }
    }
  }

  steps.push(...opSteps);

  // Special conversions once on merged totals (all applied + created for presence).
  applySpecialConversion(
    mergedOwnerValues,
    input.tagsById,
    phase2Applied,
    SPECIAL_CORROSION_CONVERSION,
    DEBUFF_CORROSION,
    CORROSION_DAMAGE,
    steps,
  );
  applySpecialConversion(
    mergedOwnerValues,
    input.tagsById,
    phase2Applied,
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
    });
  }

  return { totalsByTagId, steps };
}

export function applyInteractionsForTeamData(
  teamData: TeamData,
  appliedManifestations: Manifestation[],
  teamMaxHp?: number | null,
  teamRealms?: TeamRealmResolution,
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
  });
}
