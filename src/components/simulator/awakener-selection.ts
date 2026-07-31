import type { SlotState } from "@/components/simulator/mock-data";
import type { ForeignKeyOption } from "@/lib/actions/crud";
import type { SimulatorAwakenerOption } from "@/lib/actions/simulator";
import { conflictsWithSelected } from "@/lib/simulator/awakener-mutex";

export function buildAwakenerOptionMap(
  options: SimulatorAwakenerOption[],
): Map<number, SimulatorAwakenerOption> {
  return new Map(options.map((option) => [option.value, option]));
}

export function getSelectedAwakenerIds(
  slots: SlotState[],
  excludeIndex?: number,
): Set<number> {
  const ids = new Set<number>();
  slots.forEach((slot, index) => {
    if (index !== excludeIndex && slot.awakenerId != null) {
      ids.add(slot.awakenerId);
    }
  });
  return ids;
}

/** Distinct realm display names on the team (for UI labels). */
export function getRealmsFromSlots(
  slots: SlotState[],
  optionMap: Map<number, SimulatorAwakenerOption>,
  excludeIndex?: number,
): Set<string> {
  const realms = new Set<string>();
  slots.forEach((slot, index) => {
    if (index === excludeIndex || slot.awakenerId == null) return;
    const realm = optionMap.get(slot.awakenerId)?.realm;
    if (realm) realms.add(realm);
  });
  return realms;
}

/** Distinct realm families (`replace ?? id`) for the max-2 limit. */
export function getRealmFamilyIdsFromSlots(
  slots: SlotState[],
  optionMap: Map<number, SimulatorAwakenerOption>,
  excludeIndex?: number,
): Set<number> {
  const families = new Set<number>();
  slots.forEach((slot, index) => {
    if (index === excludeIndex || slot.awakenerId == null) return;
    const familyId = optionMap.get(slot.awakenerId)?.realmFamilyId;
    if (familyId != null) families.add(familyId);
  });
  return families;
}

function wouldExceedRealmFamilyLimit(
  optionFamilyId: number | null,
  otherFamilies: Set<number>,
): boolean {
  if (optionFamilyId == null) return false;
  const combined = new Set(otherFamilies);
  combined.add(optionFamilyId);
  return combined.size > 2;
}

export function filterAwakenerOptionsForSlot(
  options: SimulatorAwakenerOption[],
  slots: SlotState[],
  slotIndex: number,
  optionMap: Map<number, SimulatorAwakenerOption>,
): ForeignKeyOption[] {
  const selectedElsewhere = getSelectedAwakenerIds(slots, slotIndex);
  const otherFamilies = getRealmFamilyIdsFromSlots(slots, optionMap, slotIndex);
  const currentId = slots[slotIndex]?.awakenerId;

  return options.filter((option) => {
    if (option.value === currentId) return true;
    if (selectedElsewhere.has(option.value)) return false;
    if (conflictsWithSelected(option.value, selectedElsewhere)) return false;
    if (wouldExceedRealmFamilyLimit(option.realmFamilyId, otherFamilies)) {
      return false;
    }
    return true;
  });
}

/** Effective realm names after replacement collapse (hides replaced bases). */
export function formatSelectedRealms(
  slots: SlotState[],
  optionMap: Map<number, SimulatorAwakenerOption>,
): string {
  const selected: SimulatorAwakenerOption[] = [];
  for (const slot of slots) {
    if (slot.awakenerId == null) continue;
    const option = optionMap.get(slot.awakenerId);
    if (option) selected.push(option);
  }

  const replacedBases = new Set<number>();
  for (const option of selected) {
    if (
      option.realmId != null &&
      option.realmFamilyId != null &&
      option.realmId !== option.realmFamilyId
    ) {
      replacedBases.add(option.realmFamilyId);
    }
  }

  const names = new Set<string>();
  for (const option of selected) {
    if (option.realmId == null || option.realm == null) continue;
    if (replacedBases.has(option.realmId)) continue;
    names.add(option.realm);
  }
  return [...names].sort((a, b) => a.localeCompare(b)).join(", ");
}
