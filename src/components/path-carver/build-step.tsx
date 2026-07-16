"use client";

import { useMemo, useRef } from "react";
import {
  buildAwakenerOptionMap,
  filterAwakenerOptionsForSlot,
} from "@/components/simulator/awakener-selection";
import {
  AwakenerSlotRow,
  type AnchorMode,
} from "@/components/simulator/awakener-slot-row";
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
import type { AnchoredAwakenerState } from "@/lib/path-carver/types";
import { validateBuildStep } from "@/lib/path-carver/validation";

type BuildStepProps = {
  slots: SlotState[];
  anchoredAwakeners: AnchoredAwakenerState[];
  awakenerOptions: SimulatorAwakenerOption[];
  gearOptions: SimulatorGearOptions;
  onSlotsChange: (slots: SlotState[]) => void;
  onAnchoredChange: (anchors: AnchoredAwakenerState[]) => void;
};

function getAnchorMode(
  awakenerId: number | null,
  anchoredAwakeners: AnchoredAwakenerState[],
): AnchorMode {
  if (awakenerId == null) return "off";
  const anchor = anchoredAwakeners.find((a) => a.awakenerId === awakenerId);
  if (!anchor) return "off";
  return anchor.isDamageDealer ? "damageDealer" : "anchor";
}

export function BuildStep({
  slots,
  anchoredAwakeners,
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
        anchoredAwakeners,
        optionMap,
        covenantMap,
        wheelMap,
      ),
    [slots, anchoredAwakeners, optionMap, covenantMap, wheelMap],
  );

  function updateSlot(index: number, slot: SlotState) {
    const prev = slots[index];
    const next = [...slots];
    next[index] = slot;
    onSlotsChange(next);

    if (prev?.awakenerId != null && prev.awakenerId !== slot.awakenerId) {
      onAnchoredChange(
        anchoredAwakeners.filter((a) => a.awakenerId !== prev.awakenerId),
      );
    }
  }

  function setAnchorMode(index: number, mode: AnchorMode) {
    const awakenerId = slots[index]?.awakenerId;
    if (awakenerId == null) return;

    const withoutCurrent = anchoredAwakeners.filter(
      (a) => a.awakenerId !== awakenerId,
    );

    if (mode === "off") {
      onAnchoredChange(withoutCurrent);
      return;
    }

    onAnchoredChange([
      ...withoutCurrent,
      {
        awakenerId,
        isDamageDealer: mode === "damageDealer",
      },
    ]);
  }

  return (
    <div className="space-y-4">
      {!validation.valid && validation.errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Fix team constraints before continuing:</p>
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
            anchorMode={getAnchorMode(slot.awakenerId, anchoredAwakeners)}
            onAnchorModeChange={(mode) => setAnchorMode(index, mode)}
          />
        ))}
      </div>
    </div>
  );
}
