import { buildBanSet, isEntityBanned } from "@/lib/simulator/ban-filter";
import {
  loadSimulatorCatalog,
  scoreComposition,
  type SimulatorCatalog,
} from "@/lib/simulator/catalog";
import {
  buildCovenantOptionMap,
  buildWheelOptionMap,
  getSelectedTeamUniqueCovenantIds,
  getSelectedWheelIds,
  wouldViolateSsrRarityPair,
} from "@/lib/simulator/gear-selection";
import type {
  BanEntry,
  SlotState,
  TeamComposition,
} from "@/lib/simulator/types";
import { createEmptySlots } from "@/lib/simulator/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const TOP_GEAR_CANDIDATES = 5;

function getRealmsFromSlots(
  slots: SlotState[],
  catalog: SimulatorCatalog,
): Set<string> {
  const realms = new Set<string>();
  for (const slot of slots) {
    if (slot.awakenerId == null) continue;
    const awakener = catalog.awakeners.find((a) => a.id === slot.awakenerId);
    if (awakener?.realm) realms.add(awakener.realm);
  }
  return realms;
}

function wouldExceedRealmLimit(
  awakenerId: number,
  slots: SlotState[],
  catalog: SimulatorCatalog,
  excludeIndex?: number,
): boolean {
  const awakener = catalog.awakeners.find((a) => a.id === awakenerId);
  if (!awakener?.realm) return false;
  const realms = getRealmsFromSlots(
    slots.filter((_, i) => i !== excludeIndex),
    catalog,
  );
  realms.add(awakener.realm);
  return realms.size > 2;
}

function getSelectedAwakenerIds(
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

function validateAnchorConstraints(
  catalog: SimulatorCatalog,
  startAwakenerId: number,
): string | null {
  const anchors = catalog.desire.anchoredAwakenerIds;
  const uniqueAnchors = [...new Set(anchors)];

  const otherAnchors = uniqueAnchors.filter((id) => id !== startAwakenerId);
  if (otherAnchors.length > 3) {
    return "Too many anchored awakeners to fit in 4 slots alongside the start awakener.";
  }

  const allIds = [startAwakenerId, ...otherAnchors];
  const awakenerRealms = allIds
    .map((id) => catalog.awakeners.find((a) => a.id === id)?.realm)
    .filter((r): r is NonNullable<typeof r> => r != null);
  if (new Set(awakenerRealms).size > 2) {
    return "Cannot satisfy anchored awakeners within the 2-realm limit.";
  }

  return null;
}

function placeInitialAwakeners(
  startAwakenerId: number,
  catalog: SimulatorCatalog,
): SlotState[] {
  const slots = createEmptySlots();
  slots[0] = { ...slots[0], awakenerId: startAwakenerId };

  const anchors = [
    ...new Set(
      catalog.desire.anchoredAwakenerIds.filter((id) => id !== startAwakenerId),
    ),
  ];

  let slotIndex = 1;
  for (const anchorId of anchors) {
    if (slotIndex >= slots.length) break;
    slots[slotIndex] = { ...slots[slotIndex], awakenerId: anchorId };
    slotIndex++;
  }

  return slots;
}

function pickBestAwakenerForSlot(
  catalog: SimulatorCatalog,
  slots: SlotState[],
  slotIndex: number,
  posseId: number | null,
  banSet: Set<string>,
): number | null {
  const selectedElsewhere = getSelectedAwakenerIds(slots, slotIndex);
  let bestId: number | null = null;
  let bestScore = -Infinity;

  for (const awakener of catalog.awakeners) {
    if (isEntityBanned(banSet, "awakener", awakener.id)) continue;
    if (selectedElsewhere.has(awakener.id)) continue;
    if (wouldExceedRealmLimit(awakener.id, slots, catalog, slotIndex)) continue;

    const trialSlots = slots.map((s, i) =>
      i === slotIndex ? { ...s, awakenerId: awakener.id } : s,
    );
    const score = scoreComposition(catalog, {
      slots: trialSlots,
      posseId,
    });

    if (score > bestScore) {
      bestScore = score;
      bestId = awakener.id;
    }
  }

  return bestId;
}

function pickBestPosse(
  catalog: SimulatorCatalog,
  slots: SlotState[],
  banSet: Set<string>,
): number | null {
  let bestId: number | null = null;
  let bestScore = -Infinity;

  for (const posse of catalog.posseOptions) {
    if (isEntityBanned(banSet, "posse", posse.value)) continue;
    const score = scoreComposition(catalog, { slots, posseId: posse.value });
    if (score > bestScore) {
      bestScore = score;
      bestId = posse.value;
    }
  }

  return bestId;
}

function topGearCandidates(
  catalog: SimulatorCatalog,
  slots: SlotState[],
  slotIndex: number,
  posseId: number | null,
  entityType: "covenant" | "wheel",
  banSet: Set<string>,
  field: "covenantId" | "wheel1Id" | "wheel2Id",
): number | null {
  const options =
    entityType === "covenant"
      ? catalog.covenantOptions
      : catalog.wheelOptions;

  const covenantMap = buildCovenantOptionMap(catalog.covenantOptions);
  const wheelMap = buildWheelOptionMap(catalog.wheelOptions);
  const wheelExclude =
    entityType === "wheel"
      ? { slotIndex, field: field as "wheel1Id" | "wheel2Id" }
      : undefined;

  const scored: Array<{ id: number; score: number }> = [];

  for (const option of options) {
    if (isEntityBanned(banSet, entityType, option.value)) continue;

    if (entityType === "covenant") {
      const covenant = covenantMap.get(option.value);
      if (
        covenant?.teamUnique &&
        getSelectedTeamUniqueCovenantIds(slots, covenantMap, slotIndex).has(
          option.value,
        )
      ) {
        continue;
      }
    }

    if (entityType === "wheel") {
      if (
        getSelectedWheelIds(slots, wheelExclude).has(option.value)
      ) {
        continue;
      }

      const slot = slots[slotIndex];
      const siblingWheelId =
        field === "wheel1Id" ? slot?.wheel2Id : slot?.wheel1Id;
      const siblingWheel =
        siblingWheelId != null ? wheelMap.get(siblingWheelId) : undefined;
      const candidateWheel = wheelMap.get(option.value);
      if (
        candidateWheel &&
        wouldViolateSsrRarityPair(candidateWheel, siblingWheel)
      ) {
        continue;
      }
    }

    const trialSlots = slots.map((s, i) =>
      i === slotIndex ? { ...s, [field]: option.value } : s,
    );
    const score = scoreComposition(catalog, { slots: trialSlots, posseId });
    scored.push({ id: option.value, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, TOP_GEAR_CANDIDATES);
  if (top.length === 0) return null;

  return top[0].id;
}

function fillGearForSlot(
  catalog: SimulatorCatalog,
  slots: SlotState[],
  slotIndex: number,
  posseId: number | null,
  banSet: Set<string>,
): SlotState {
  let slot = slots[slotIndex];
  if (slot.awakenerId == null) return slot;

  if (slot.covenantId == null) {
    const covenantId = topGearCandidates(
      catalog,
      slots,
      slotIndex,
      posseId,
      "covenant",
      banSet,
      "covenantId",
    );
    if (covenantId != null) {
      slot = { ...slot, covenantId };
      slots = slots.map((s, i) => (i === slotIndex ? slot : s));
    }
  }

  if (slot.wheel1Id == null) {
    const wheel1Id = topGearCandidates(
      catalog,
      slots,
      slotIndex,
      posseId,
      "wheel",
      banSet,
      "wheel1Id",
    );
    if (wheel1Id != null) {
      slot = { ...slot, wheel1Id };
      slots = slots.map((s, i) => (i === slotIndex ? slot : s));
    }
  }

  if (slot.wheel2Id == null) {
    const wheel2Id = topGearCandidates(
      catalog,
      slots,
      slotIndex,
      posseId,
      "wheel",
      banSet,
      "wheel2Id",
    );
    if (wheel2Id != null) {
      slot = { ...slot, wheel2Id };
    }
  }

  return slot;
}

export async function generateTeamForDesire(
  supabase: SupabaseClient<Database>,
  desireId: number,
  startAwakenerId: number,
  banEntries: BanEntry[],
): Promise<{ slots: SlotState[]; posseId: number | null; desireName: string }> {
  const catalog = await loadSimulatorCatalog(supabase, desireId);
  const banSet = buildBanSet(banEntries);

  if (isEntityBanned(banSet, "awakener", startAwakenerId)) {
    throw new Error("Start awakener is banned.");
  }

  const anchorError = validateAnchorConstraints(catalog, startAwakenerId);
  if (anchorError) throw new Error(anchorError);

  let slots = placeInitialAwakeners(startAwakenerId, catalog);
  let posseId: number | null = null;

  for (let i = 0; i < slots.length; i++) {
    if (slots[i].awakenerId != null) continue;
    const bestId = pickBestAwakenerForSlot(catalog, slots, i, posseId, banSet);
    if (bestId != null) {
      slots = slots.map((s, idx) =>
        idx === i ? { ...s, awakenerId: bestId } : s,
      );
    }
  }

  posseId = pickBestPosse(catalog, slots, banSet);

  for (let i = 0; i < slots.length; i++) {
    slots = slots.map((s, idx) =>
      idx === i ? fillGearForSlot(catalog, slots, i, posseId, banSet) : s,
    );
  }

  return {
    slots,
    posseId,
    desireName: catalog.desire.name,
  };
}

export async function recommendEmptySlots(
  supabase: SupabaseClient<Database>,
  desireId: number,
  slots: SlotState[],
  posseId: number | null,
  banEntries: BanEntry[],
): Promise<{ slots: SlotState[]; posseId: number | null }> {
  const catalog = await loadSimulatorCatalog(supabase, desireId);
  const banSet = buildBanSet(banEntries);

  let updatedSlots = slots.map((s) => ({ ...s }));
  let updatedPosseId = posseId;

  for (let i = 0; i < updatedSlots.length; i++) {
    if (updatedSlots[i].awakenerId != null) continue;
    const bestId = pickBestAwakenerForSlot(
      catalog,
      updatedSlots,
      i,
      updatedPosseId,
      banSet,
    );
    if (bestId != null) {
      updatedSlots = updatedSlots.map((s, idx) =>
        idx === i ? { ...s, awakenerId: bestId } : s,
      );
    }
  }

  if (updatedPosseId == null) {
    updatedPosseId = pickBestPosse(catalog, updatedSlots, banSet);
  }

  for (let i = 0; i < updatedSlots.length; i++) {
    const slot = updatedSlots[i];
    if (slot.awakenerId == null) continue;

    let updated = { ...slot };
    if (updated.covenantId == null) {
      const covenantId = topGearCandidates(
        catalog,
        updatedSlots,
        i,
        updatedPosseId,
        "covenant",
        banSet,
        "covenantId",
      );
      if (covenantId != null) updated = { ...updated, covenantId };
    }
    if (updated.wheel1Id == null) {
      const wheel1Id = topGearCandidates(
        catalog,
        updatedSlots.map((s, idx) => (idx === i ? updated : s)),
        i,
        updatedPosseId,
        "wheel",
        banSet,
        "wheel1Id",
      );
      if (wheel1Id != null) updated = { ...updated, wheel1Id };
    }
    if (updated.wheel2Id == null) {
      const wheel2Id = topGearCandidates(
        catalog,
        updatedSlots.map((s, idx) => (idx === i ? updated : s)),
        i,
        updatedPosseId,
        "wheel",
        banSet,
        "wheel2Id",
      );
      if (wheel2Id != null) updated = { ...updated, wheel2Id };
    }

    updatedSlots = updatedSlots.map((s, idx) => (idx === i ? updated : s));
  }

  return { slots: updatedSlots, posseId: updatedPosseId };
}
