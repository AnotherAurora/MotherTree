"use client";

import { useMemo, useRef } from "react";
import {
  buildAwakenerOptionMap,
  filterAwakenerOptionsForSlot,
} from "@/components/simulator/awakener-selection";
import { AwakenerSlotRow } from "@/components/simulator/awakener-slot-row";
import type { SlotState } from "@/components/simulator/mock-data";
import type { AwakenerRelatedTags } from "@/lib/actions/simulator";
import type { SimulatorGearOptions } from "@/lib/actions/simulator-flow";
import type { SimulatorAwakenerOption } from "@/lib/actions/simulator";
import {
  buildCovenantOptionMap,
  buildWheelOptionMap,
  filterCovenantOptionsForSlot,
  filterWheelOptionsForSlot,
} from "@/lib/simulator/gear-selection";
import { validateBuildStep } from "@/lib/path-carver/validation";

type BuildStepProps = {
  slots: SlotState[];
  posseId: number | null;
  anchoredAwakenerIds: number[];
  awakenerOptions: SimulatorAwakenerOption[];
  gearOptions: SimulatorGearOptions;
  onSlotsChange: (slots: SlotState[]) => void;
  onAnchoredChange: (ids: number[]) => void;
};

export function BuildStep({
  slots,
  posseId,
  anchoredAwakenerIds,
  awakenerOptions,
  gearOptions,
  onSlotsChange,
  onAnchoredChange,
}: BuildStepProps) {
  const tagCacheRef = useRef(new Map<number, AwakenerRelatedTags>());
  const optionMap = useMemo(
    () => buildAwakenerOptionMap(awakenerOptions),
    [awakenerOptions],
  );

  const filteredOptionsBySlot = useMemo(
    () =>
      slots.map((_, index) =>
        filterAwakenerOptionsForSlot(
          awakenerOptions,
          slots,
          index,
          optionMap,
        ),
      ),
    [awakenerOptions, slots, optionMap],
  );

  const covenantMap = useMemo(
    () => buildCovenantOptionMap(gearOptions.covenant),
    [gearOptions.covenant],
  );

  const wheelMap = useMemo(
    () => buildWheelOptionMap(gearOptions.wheel),
    [gearOptions.wheel],
  );

  const filteredCovenantBySlot = useMemo(
    () =>
      slots.map((_, index) =>
        filterCovenantOptionsForSlot(
          gearOptions.covenant,
          slots,
          index,
          covenantMap,
        ),
      ),
    [gearOptions.covenant, slots, covenantMap],
  );

  const filteredWheel1BySlot = useMemo(
    () =>
      slots.map((_, index) =>
        filterWheelOptionsForSlot(
          gearOptions.wheel,
          slots,
          index,
          "wheel1Id",
          wheelMap,
        ),
      ),
    [gearOptions.wheel, slots, wheelMap],
  );

  const filteredWheel2BySlot = useMemo(
    () =>
      slots.map((_, index) =>
        filterWheelOptionsForSlot(
          gearOptions.wheel,
          slots,
          index,
          "wheel2Id",
          wheelMap,
        ),
      ),
    [gearOptions.wheel, slots, wheelMap],
  );

  const validation = useMemo(
    () =>
      validateBuildStep(
        slots,
        posseId,
        anchoredAwakenerIds,
        optionMap,
        covenantMap,
        wheelMap,
      ),
    [slots, posseId, anchoredAwakenerIds, optionMap, covenantMap, wheelMap],
  );

  function updateSlot(index: number, slot: SlotState) {
    const prev = slots[index];
    const next = [...slots];
    next[index] = slot;
    onSlotsChange(next);

    if (prev?.awakenerId != null && prev.awakenerId !== slot.awakenerId) {
      onAnchoredChange(
        anchoredAwakenerIds.filter((id) => id !== prev.awakenerId),
      );
    }
  }

  function toggleAnchor(index: number, anchored: boolean) {
    const awakenerId = slots[index]?.awakenerId;
    if (awakenerId == null) return;

    if (anchored) {
      if (!anchoredAwakenerIds.includes(awakenerId)) {
        onAnchoredChange([...anchoredAwakenerIds, awakenerId]);
      }
    } else {
      onAnchoredChange(anchoredAwakenerIds.filter((id) => id !== awakenerId));
    }
  }

  return (
    <div className="space-y-4">
      {!validation.valid && validation.errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Complete the team before continuing:</p>
          <ul className="mt-1 list-inside list-disc">
            {validation.errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {slots.map((slot, index) => (
          <AwakenerSlotRow
            key={index}
            index={index}
            slot={slot}
            awakenerOptions={filteredOptionsBySlot[index] ?? []}
            covenantOptions={filteredCovenantBySlot[index] ?? []}
            wheel1Options={filteredWheel1BySlot[index] ?? []}
            wheel2Options={filteredWheel2BySlot[index] ?? []}
            getCachedTags={(id) => tagCacheRef.current.get(id)}
            setCachedTags={(id, tags) => {
              tagCacheRef.current.set(id, tags);
            }}
            onChange={(updated) => updateSlot(index, updated)}
            showRelatedTags={false}
            showAnchorToggle
            isAnchored={
              slot.awakenerId != null &&
              anchoredAwakenerIds.includes(slot.awakenerId)
            }
            onAnchorChange={(anchored) => toggleAnchor(index, anchored)}
            anchorDisabled={slot.awakenerId == null}
          />
        ))}
      </div>
    </div>
  );
}