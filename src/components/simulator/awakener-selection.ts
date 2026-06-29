import type { SlotState } from "@/components/simulator/mock-data";
import type { ForeignKeyOption } from "@/lib/actions/crud";
import type { SimulatorAwakenerOption } from "@/lib/actions/simulator";

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

function wouldExceedRealmLimit(
  optionRealm: string | null,
  otherRealms: Set<string>,
): boolean {
  if (!optionRealm) return false;
  const combined = new Set(otherRealms);
  combined.add(optionRealm);
  return combined.size > 2;
}

export function filterAwakenerOptionsForSlot(
  options: SimulatorAwakenerOption[],
  slots: SlotState[],
  slotIndex: number,
  optionMap: Map<number, SimulatorAwakenerOption>,
): ForeignKeyOption[] {
  const selectedElsewhere = getSelectedAwakenerIds(slots, slotIndex);
  const otherRealms = getRealmsFromSlots(slots, optionMap, slotIndex);
  const currentId = slots[slotIndex]?.awakenerId;

  return options.filter((option) => {
    if (option.value === currentId) return true;
    if (selectedElsewhere.has(option.value)) return false;
    if (wouldExceedRealmLimit(option.realm, otherRealms)) return false;
    return true;
  });
}

export function formatSelectedRealms(
  slots: SlotState[],
  optionMap: Map<number, SimulatorAwakenerOption>,
): string {
  const realms = new Set<string>();
  for (const slot of slots) {
    if (slot.awakenerId == null) continue;
    const realm = optionMap.get(slot.awakenerId)?.realm;
    if (realm) realms.add(realm);
  }
  return [...realms].sort((a, b) => a.localeCompare(b)).join(", ");
}
