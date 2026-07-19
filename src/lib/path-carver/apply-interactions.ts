import { matchesDemandTag } from "@/lib/simulator/tag-matching";
import type {
  DefaultInteraction,
  InteractionOverride,
  Manifestation,
  OperationType,
  Tag,
  TargetType,
  TeamData,
} from "@/lib/team-data/types";

/** Multi-pass chain limit until values stabilize. Documented for Phase 2a. */
export const INTERACTION_MAX_PASSES = 8;

const TEAM_POOL_OWNER = "*team*";

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
      scalar: number;
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
    }
  | { kind: "special"; label: string; detail: string }
  | { kind: "total"; tagId: number; tagName: string; total: number };

export type ApplyInteractionsInput = {
  manifestations: Manifestation[];
  /** Layer A applied manifestations only. */
  appliedManifestations: Manifestation[];
  defaultInteractions: DefaultInteraction[];
  tagsById: Record<number, Tag>;
  /** Awakener id → display name for debug source labels. */
  awakenerNamesById?: ReadonlyMap<number, string>;
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
  if (m.awakenerId != null) return `awakener:${m.awakenerId}`;
  return `orphan:${m.sourceKind}:${m.id}`;
}

function sourceLabelFor(
  m: Manifestation,
  awakenerNamesById?: ReadonlyMap<number, string>,
): string {
  if (m.sourceKind === "posse") return "posse";

  const awakenerName =
    m.awakenerId != null
      ? (awakenerNamesById?.get(m.awakenerId) ?? `#${m.awakenerId}`)
      : null;

  if (m.sourceKind === "awakener") {
    return awakenerName ?? `awakener #${m.id}`;
  }

  const slot =
    m.slotIndex != null ? ` slot ${m.slotIndex + 1}` : "";
  if (awakenerName != null) {
    return `${m.sourceKind}${slot} (${awakenerName})`;
  }
  return `${m.sourceKind}${slot || ` #${m.id}`}`;
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

function opPriority(op: OperationType): number {
  // Temporary 2a/2b order: add_scaled first, then multipliers. Replaced in 2c.
  if (op === "add_scaled") return 0;
  return 1;
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
): InteractionOverride | null {
  let found: InteractionOverride | null = null;
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

function resolveOpAndFactor(
  interaction: DefaultInteraction,
  override: InteractionOverride | null,
): { op: OperationType; factor: number; disabled: boolean } {
  if (override?.isDisabled) {
    return {
      op: interaction.mathOperation,
      factor: interaction.defaultFactor ?? 0,
      disabled: true,
    };
  }

  const op = override?.mathOperation ?? interaction.mathOperation;
  const factor =
    override?.valueScalar != null
      ? override.valueScalar
      : (interaction.defaultFactor ?? 0);

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
 * Sum every owner + *team* bucket for tagId and clear them all.
 */
function sumAndClearTag(ownerValues: OwnerTotals, tagId: number): number {
  let total = 0;
  for (const map of ownerValues.values()) {
    const value = map.get(tagId);
    if (value != null && value !== 0) total += value;
    map.delete(tagId);
  }
  return total;
}

/**
 * presence_multiply is boolean presence: for each matched target tag, multiply
 * the combined (owner + *team*) total exactly once this pass (single ceil).
 * Descendants still match via prefix unless excluded.
 */
function applyPresenceMultiplyOnce(
  interaction: DefaultInteraction,
  appliedManifestations: Manifestation[],
  current: OwnerTotals,
  next: OwnerTotals,
  targets: Tag[],
  modifierTagId: number,
  modifierTagName: string,
  steps: ScalarMathStep[],
  pass: number,
  presenceApplied: Set<string>,
  effectSources: string[],
): void {
  for (const target of targets) {
    const ownersWithTarget = collectOwnersWithTarget(
      current,
      next,
      target.id,
    );
    const teamHasTarget =
      getOwnerValue(next, TEAM_POOL_OWNER, target.id) !== 0 ||
      getOwnerValue(current, TEAM_POOL_OWNER, target.id) !== 0;

    if (ownersWithTarget.size === 0 && !teamHasTarget) continue;

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
        const resolved = resolveOpAndFactor(interaction, override);
        factor = resolved.factor;
        break;
      }
    }

    if (allDisabled) continue;

    const combined = sumAndClearTag(next, target.id);
    if (combined === 0) continue;

    // Seed the combined total into *team*, then multiply once.
    setOwnerValue(next, TEAM_POOL_OWNER, target.id, combined);
    applyOpAndRecord(
      next,
      TEAM_POOL_OWNER,
      target,
      modifierTagName,
      1,
      factor,
      "presence_multiply",
      steps,
      pass,
      modifierTagId,
      presenceApplied,
      effectSources,
    );
  }
}

/**
 * Apply one interaction onto `next`, reading modifier values from `current`
 * and starting target values from `next` (which begins as a clone of base each
 * pass, then accumulates earlier ops in this pass).
 */
function applyInteractionOnto(
  interaction: DefaultInteraction,
  appliedManifestations: Manifestation[],
  current: OwnerTotals,
  next: OwnerTotals,
  tagsById: Record<number, Tag>,
  steps: ScalarMathStep[],
  pass: number,
  presenceApplied: Set<string>,
  awakenerNamesById?: ReadonlyMap<number, string>,
): void {
  const modifierTagId = interaction.modifierTagId;
  const targetTagName = interaction.targetTagName;
  if (modifierTagId == null || !targetTagName) return;

  const modifierTagName =
    tagsById[modifierTagId]?.tagName ??
    interaction.modifierTagName ??
    `#${modifierTagId}`;

  // Phase 2a: ignore non-null buff_target_type_restriction (no branching yet).
  // Rows still apply as if the restriction were null. Phase 2b adds splits.

  const modifierManifests = collectModifierManifestations(
    appliedManifestations,
    modifierTagId,
  );
  if (modifierManifests.length === 0) return;

  const effectSources = effectSourcesFromManifests(
    modifierManifests,
    awakenerNamesById,
  );

  const targets = matchingTargetTags(
    tagsById,
    targetTagName,
    interaction.exclusionTagName,
  );
  if (targets.length === 0) return;

  // Boolean presence: one unified pass, never self+non-self double multiply.
  if (interaction.mathOperation === "presence_multiply") {
    applyPresenceMultiplyOnce(
      interaction,
      appliedManifestations,
      current,
      next,
      targets,
      modifierTagId,
      modifierTagName,
      steps,
      pass,
      presenceApplied,
      effectSources,
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

  for (const owner of selfOwners) {
    const modValue =
      getOwnerValue(current, owner, modifierTagId) +
      getOwnerValue(current, TEAM_POOL_OWNER, modifierTagId);
    const ownerHasModifier = modifierManifests.some(
      (m) => ownerKeyFor(m) === owner,
    );

    for (const target of targets) {
      // Match non-self: only touch targets this owner already has applied.
      if (
        !ownerHasTag(next, owner, target.id) &&
        !ownerHasTag(current, owner, target.id)
      ) {
        continue;
      }

      const override = findTargetOverride(
        appliedManifestations,
        owner,
        target.id,
        modifierTagId,
      );
      const resolved = resolveOpAndFactor(interaction, override);
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
  let modValue = 0;
  for (const owner of nonSelfOwners) {
    modValue += getOwnerValue(current, owner, modifierTagId);
  }
  // Include team-pool modifier value (from prior team-wide adds into the modifier tag).
  modValue += getOwnerValue(current, TEAM_POOL_OWNER, modifierTagId);

  const present = modValue !== 0 || nonSelfOwners.size > 0;

  for (const target of targets) {
    const ownersWithTarget = collectOwnersWithTarget(
      current,
      next,
      target.id,
    );

    let defaultOp = interaction.mathOperation;
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
        const resolved = resolveOpAndFactor(interaction, override);
        defaultOp = resolved.op;
        defaultFactor = resolved.factor;
        break;
      }
    }

    if (allDisabled) continue;

    if (defaultOp === "presence_multiply") {
      if (!present) continue;
      for (const owner of ownersWithTarget) {
        const override = findTargetOverride(
          appliedManifestations,
          owner,
          target.id,
          modifierTagId,
        );
        if (override?.isDisabled) continue;
        const resolved = resolveOpAndFactor(interaction, override);
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
        );
      }
      if (getOwnerValue(next, TEAM_POOL_OWNER, target.id) !== 0) {
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
        );
      }
      continue;
    }

    if (defaultOp === "add_scaled") {
      // Flat add once into the team pool (relative to current next value).
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
      );
      continue;
    }

    // multiply_one_plus / multiply
    for (const owner of ownersWithTarget) {
      const override = findTargetOverride(
        appliedManifestations,
        owner,
        target.id,
        modifierTagId,
      );
      if (override?.isDisabled) continue;
      const resolved = resolveOpAndFactor(interaction, override);
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
      );
    }
    if (getOwnerValue(next, TEAM_POOL_OWNER, target.id) !== 0) {
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

/**
 * Layer B — apply tag_default_interaction (+ overrides) and Special conversions.
 *
 * Matching: exact modifier, prefix target, exclusion = tag + descendants.
 * Self-scope: modifier target_type=self only updates same-owner tags.
 * Temp op order: add_scaled then presence_multiply / multiply_one_plus / multiply.
 * presence_multiply is boolean (at most once per modifier/target tag per pass;
 * combined owner+*team* total, single ceil).
 * Multiply ops round up after each write (percent → 0.01, else whole number).
 * Multi-pass: each pass recomputes from Layer A base using prior-pass values
 * as modifier inputs (avoids re-stacking the same op).
 * Buff restriction: ignored in Phase 2a.
 * dependency_stat scaling: not applied (Phase 2b).
 */
export function applyInteractions(
  input: ApplyInteractionsInput,
): ApplyInteractionsResult {
  const steps: ScalarMathStep[] = [];
  const base: OwnerTotals = new Map();

  for (const m of input.appliedManifestations) {
    const scalar = m.valueScalar ?? 0;
    if (scalar === 0) continue;
    addOwnerValue(base, ownerKeyFor(m), m.tagId, scalar);
    steps.push({
      kind: "base",
      tagId: m.tagId,
      tagName: m.tagName,
      owner: ownerKeyFor(m),
      scalar,
      sourceLabel: sourceLabelFor(m, input.awakenerNamesById),
    });
  }

  const orderedInteractions = [...input.defaultInteractions].sort(
    (a, b) =>
      opPriority(a.mathOperation) - opPriority(b.mathOperation) ||
      a.id - b.id,
  );

  let current = cloneOwnerTotals(base);
  // Only keep op steps from the final stabilizing pass (plus base/special/total).
  let lastPassOpSteps: ScalarMathStep[] = [];

  for (let pass = 0; pass < INTERACTION_MAX_PASSES; pass++) {
    // Recompute from base each pass; read modifiers from `current`.
    const next = cloneOwnerTotals(base);
    const passOpSteps: ScalarMathStep[] = [];
    const presenceApplied = new Set<string>();

    for (const interaction of orderedInteractions) {
      applyInteractionOnto(
        interaction,
        input.appliedManifestations,
        current,
        next,
        input.tagsById,
        passOpSteps,
        pass,
        presenceApplied,
        input.awakenerNamesById,
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

  // Special conversions run after interaction passes (hardcoded; not interaction rows).
  applySpecialConversion(
    current,
    input.tagsById,
    input.appliedManifestations,
    SPECIAL_CORROSION_CONVERSION,
    DEBUFF_CORROSION,
    CORROSION_DAMAGE,
    steps,
  );
  applySpecialConversion(
    current,
    input.tagsById,
    input.appliedManifestations,
    SPECIAL_EMBERS_CONVERSION,
    DEBUFF_EMBERS,
    EMBERS_DAMAGE,
    steps,
  );

  const totalsByTagId = new Map<number, number>();
  for (const map of current.values()) {
    for (const [tagId, value] of map) {
      if (value === 0) continue;
      totalsByTagId.set(tagId, (totalsByTagId.get(tagId) ?? 0) + value);
    }
  }

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
    awakenerNamesById,
  });
}
