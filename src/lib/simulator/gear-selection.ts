import type { ForeignKeyOption } from "@/lib/actions/crud";
import type {
  CovenantGearOption,
  SlotState,
  WheelGearOption,
} from "@/lib/simulator/types";

export type WheelField = "wheel1Id" | "wheel2Id";

export type WheelExclude = {
  slotIndex: number;
  field: WheelField;
};

export function buildCovenantOptionMap(
  options: CovenantGearOption[],
): Map<number, CovenantGearOption> {
  return new Map(options.map((option) => [option.value, option]));
}

export function buildWheelOptionMap(
  options: WheelGearOption[],
): Map<number, WheelGearOption> {
  return new Map(options.map((option) => [option.value, option]));
}

export function isSsrWithoutEnlightenment15(wheel: WheelGearOption): boolean {
  return wheel.rarity === "SSR" && wheel.enlightenment !== 15;
}

export function getSelectedWheelIds(
  slots: SlotState[],
  exclude?: WheelExclude,
): Set<number> {
  const ids = new Set<number>();
  slots.forEach((slot, slotIndex) => {
    for (const field of ["wheel1Id", "wheel2Id"] as const) {
      if (
        exclude?.slotIndex === slotIndex &&
        exclude.field === field
      ) {
        continue;
      }
      const wheelId = slot[field];
      if (wheelId != null) ids.add(wheelId);
    }
  });
  return ids;
}

export function getSelectedTeamUniqueCovenantIds(
  slots: SlotState[],
  covenantMap: Map<number, CovenantGearOption>,
  excludeIndex?: number,
): Set<number> {
  const ids = new Set<number>();
  slots.forEach((slot, index) => {
    if (index === excludeIndex || slot.covenantId == null) return;
    const covenant = covenantMap.get(slot.covenantId);
    if (covenant?.teamUnique) ids.add(slot.covenantId);
  });
  return ids;
}

function getSiblingWheelId(
  slot: SlotState,
  field: WheelField,
): number | null {
  return field === "wheel1Id" ? slot.wheel2Id : slot.wheel1Id;
}

export function wouldViolateSsrRarityPair(
  candidate: WheelGearOption,
  siblingWheel: WheelGearOption | undefined,
): boolean {
  if (!siblingWheel) return false;
  if (candidate.rarity !== "SSR" || siblingWheel.rarity !== "SSR") return false;
  return (
    isSsrWithoutEnlightenment15(candidate) &&
    isSsrWithoutEnlightenment15(siblingWheel)
  );
}

export function filterCovenantOptionsForSlot(
  options: CovenantGearOption[],
  slots: SlotState[],
  slotIndex: number,
  covenantMap: Map<number, CovenantGearOption>,
): ForeignKeyOption[] {
  const selectedTeamUniqueElsewhere = getSelectedTeamUniqueCovenantIds(
    slots,
    covenantMap,
    slotIndex,
  );
  const currentId = slots[slotIndex]?.covenantId;

  return options.filter((option) => {
    if (option.value === currentId) return true;
    if (!option.teamUnique) return true;
    return !selectedTeamUniqueElsewhere.has(option.value);
  });
}

export function filterWheelOptionsForSlot(
  options: WheelGearOption[],
  slots: SlotState[],
  slotIndex: number,
  field: WheelField,
  wheelMap: Map<number, WheelGearOption>,
): ForeignKeyOption[] {
  const selectedElsewhere = getSelectedWheelIds(slots, { slotIndex, field });
  const slot = slots[slotIndex];
  const currentId = slot?.[field];
  const siblingWheelId = slot ? getSiblingWheelId(slot, field) : null;
  const siblingWheel =
    siblingWheelId != null ? wheelMap.get(siblingWheelId) : undefined;
  const siblingBlocksNon15Ssr =
    siblingWheel != null && isSsrWithoutEnlightenment15(siblingWheel);

  return options.filter((option) => {
    if (option.value === currentId) return true;
    if (selectedElsewhere.has(option.value)) return false;
    if (siblingBlocksNon15Ssr && isSsrWithoutEnlightenment15(option)) {
      return false;
    }
    return true;
  });
}
