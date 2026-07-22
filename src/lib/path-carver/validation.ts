import {
  getRealmsFromSlots,
} from "@/components/simulator/awakener-selection";
import {
  isSsrWithoutEnlightenment15,
} from "@/lib/simulator/gear-selection";
import type { SimulatorAwakenerOption } from "@/lib/actions/simulator";
import type {
  DraftDemandSelection,
  EditableDemand,
  SaveDemandInput,
  AnchoredAwakenerState,
} from "@/lib/path-carver/types";
import type {
  CovenantGearOption,
  SlotState,
  WheelGearOption,
} from "@/lib/simulator/types";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

function result(valid: boolean, errors: string[]): ValidationResult {
  return { valid, errors };
}

export function validateGearConstraints(
  slots: SlotState[],
  covenantMap: Map<number, CovenantGearOption>,
  wheelMap: Map<number, WheelGearOption>,
): ValidationResult {
  const errors: string[] = [];

  const wheelCounts = new Map<number, number>();
  for (const slot of slots) {
    for (const wheelId of [slot.wheel1Id, slot.wheel2Id]) {
      if (wheelId == null) continue;
      wheelCounts.set(wheelId, (wheelCounts.get(wheelId) ?? 0) + 1);
    }
  }
  for (const count of wheelCounts.values()) {
    if (count > 1) {
      errors.push("Duplicate wheels across team");
      break;
    }
  }

  const teamUniqueCovenantCounts = new Map<number, number>();
  for (const slot of slots) {
    if (slot.covenantId == null) continue;
    const covenant = covenantMap.get(slot.covenantId);
    if (!covenant?.teamUnique) continue;
    teamUniqueCovenantCounts.set(
      slot.covenantId,
      (teamUniqueCovenantCounts.get(slot.covenantId) ?? 0) + 1,
    );
  }
  for (const count of teamUniqueCovenantCounts.values()) {
    if (count > 1) {
      errors.push("Duplicate team-unique covenant across team");
      break;
    }
  }

  slots.forEach((slot, index) => {
    if (slot.wheel1Id == null || slot.wheel2Id == null) return;
    const wheel1 = wheelMap.get(slot.wheel1Id);
    const wheel2 = wheelMap.get(slot.wheel2Id);
    if (!wheel1 || !wheel2) return;
    if (
      wheel1.rarity === "SSR" &&
      wheel2.rarity === "SSR" &&
      isSsrWithoutEnlightenment15(wheel1) &&
      isSsrWithoutEnlightenment15(wheel2)
    ) {
      errors.push(
        `Awakener ${index + 1}: cannot equip two SSR wheels unless one has enlightenment 15`,
      );
    }
  });

  return result(errors.length === 0, errors);
}

export function validateAwakenerConstraints(
  slots: SlotState[],
  optionMap: Map<number, SimulatorAwakenerOption>,
): ValidationResult {
  const errors: string[] = [];
  const seen = new Set<number>();

  for (const slot of slots) {
    if (slot.awakenerId == null) continue;
    if (seen.has(slot.awakenerId)) {
      errors.push("Duplicate awakeners across slots");
      break;
    }
    seen.add(slot.awakenerId);
  }

  const realms = getRealmsFromSlots(slots, optionMap);
  if (realms.size > 2) {
    errors.push(`${realms.size} realms selected (max 2)`);
  }

  return result(errors.length === 0, errors);
}

const MAX_ANCHORS = 4;

export function validateAnchors(
  anchoredAwakeners: AnchoredAwakenerState[],
  slots: SlotState[],
): ValidationResult {
  const errors: string[] = [];
  const teamAwakenerIds = new Set(
    slots
      .map((s) => s.awakenerId)
      .filter((id): id is number => id != null),
  );
  const anchoredIds = anchoredAwakeners.map((a) => a.awakenerId);

  if (anchoredIds.length > MAX_ANCHORS) {
    errors.push(`Too many anchors (${anchoredIds.length}, max ${MAX_ANCHORS})`);
  }

  const uniqueAnchors = new Set(anchoredIds);
  if (uniqueAnchors.size !== anchoredIds.length) {
    errors.push("Duplicate anchor awakeners");
  }

  for (const anchorId of anchoredIds) {
    if (!teamAwakenerIds.has(anchorId)) {
      errors.push("Anchor must be an awakener in the current team");
      break;
    }
  }

  return result(errors.length === 0, errors);
}

export function validateBuildStep(
  slots: SlotState[],
  anchoredAwakeners: AnchoredAwakenerState[],
  optionMap: Map<number, SimulatorAwakenerOption>,
  covenantMap: Map<number, CovenantGearOption>,
  wheelMap: Map<number, WheelGearOption>,
): ValidationResult {
  const results = [
    validateAwakenerConstraints(slots, optionMap),
    validateGearConstraints(slots, covenantMap, wheelMap),
    validateAnchors(anchoredAwakeners, slots),
  ];
  const errors = results.flatMap((r) => r.errors);
  return result(errors.length === 0, errors);
}

export function validateDemandTagIds(
  demands: { tagId: number }[],
): ValidationResult {
  const seen = new Set<number>();
  const errors: string[] = [];

  for (const demand of demands) {
    if (seen.has(demand.tagId)) {
      errors.push("Duplicate tag in demands");
      break;
    }
    seen.add(demand.tagId);
  }

  return result(errors.length === 0, errors);
}

export function validateReview1Selections(
  selections: DraftDemandSelection[],
  existingDemands: EditableDemand[] = [],
  mode: "create" | "edit" = "create",
): ValidationResult {
  const errors: string[] = [];
  const activeExisting = existingDemands.filter((d) => !d.markedForDelete);

  if (mode === "create" && selections.length === 0) {
    errors.push("Select at least one tag as a core demand");
  }

  if (mode === "edit" && selections.length === 0 && activeExisting.length === 0) {
    errors.push("Select at least one tag or keep an existing demand");
  }

  const dupCheck = validateDemandTagIds(selections);
  errors.push(...dupCheck.errors);

  const existingTagIds = new Set(activeExisting.map((d) => d.tagId));
  for (const sel of selections) {
    if (existingTagIds.has(sel.tagId)) {
      errors.push(`Tag "${sel.tagName}" already exists as a demand`);
      break;
    }
  }

  return result(errors.length === 0, errors);
}

export function validateReview2Demands(
  demands: SaveDemandInput[],
): ValidationResult {
  const errors: string[] = [];

  if (demands.length === 0) {
    errors.push("At least one demand is required");
  }

  for (const demand of demands) {
    if (demand.targetValue <= 0) {
      errors.push("Target value must be greater than 0");
      break;
    }
    if (demand.basePriorityWeight <= 0) {
      errors.push("Base priority weight must be greater than 0");
      break;
    }
    if (demand.decayRate <= 0) {
      errors.push("Decay rate must be greater than 0");
      break;
    }
    if (!demand.curve) {
      errors.push("Curve is required for all demands");
      break;
    }
  }

  const dupCheck = validateDemandTagIds(demands);
  errors.push(...dupCheck.errors);

  return result(errors.length === 0, errors);
}

export function validateDesireName(name: string): ValidationResult {
  if (!name.trim()) {
    return result(false, ["Desire name is required"]);
  }
  return result(true, []);
}