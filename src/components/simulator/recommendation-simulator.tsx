"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildAwakenerOptionMap,
  filterAwakenerOptionsForSlot,
  formatSelectedRealms,
} from "@/components/simulator/awakener-selection";
import { AwakenerSlotRow } from "@/components/simulator/awakener-slot-row";
import {
  createEmptySlots,
  INITIAL_BAN_LIST,
  type SlotState,
} from "@/components/simulator/mock-data";
import { SimulatorHeader } from "@/components/simulator/simulator-header";
import { SimulatorSidebar } from "@/components/simulator/simulator-sidebar";
import type {
  AwakenerRelatedTags,
  SimulatorAwakenerOption,
} from "@/lib/actions/simulator";

type RecommendationSimulatorProps = {
  awakenerOptions: SimulatorAwakenerOption[];
};

export function RecommendationSimulator({
  awakenerOptions,
}: RecommendationSimulatorProps) {
  const [posse, setPosse] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const [slots, setSlots] = useState<SlotState[]>(createEmptySlots);
  const [banList, setBanList] = useState<string[]>([...INITIAL_BAN_LIST]);
  const tagCacheRef = useRef(new Map<number, AwakenerRelatedTags>());

  const optionMap = useMemo(
    () => buildAwakenerOptionMap(awakenerOptions),
    [awakenerOptions],
  );

  const realmDisplay = useMemo(
    () => formatSelectedRealms(slots, optionMap),
    [slots, optionMap],
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

  function handleSlotChange(index: number, slot: SlotState) {
    setSlots((prev) => prev.map((s, i) => (i === index ? slot : s)));
  }

  const getCachedTags = useCallback((awakenerId: number) => {
    return tagCacheRef.current.get(awakenerId);
  }, []);

  const setCachedTags = useCallback(
    (awakenerId: number, tags: AwakenerRelatedTags) => {
      tagCacheRef.current.set(awakenerId, tags);
    },
    [],
  );

  function handleClearPath() {
    setPath("");
  }

  function handleRemoveBan(tag: string) {
    setBanList((prev) => prev.filter((t) => t !== tag));
  }

  function handleClearAllBans() {
    setBanList([]);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Recommendation Simulator Debugger
        </h1>
        <p className="mt-2 text-zinc-600">
          UI prototype for simulating the recommendations system. Awakener
          dropdowns and related tag lists use live database data; other controls
          and simulation logic are not yet wired.
        </p>
      </div>

      <SimulatorHeader
        realm={realmDisplay}
        posse={posse}
        path={path}
        onPosseChange={setPosse}
        onClearPath={handleClearPath}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-[2] flex-col gap-4">
          {slots.map((slot, index) => (
            <AwakenerSlotRow
              key={index}
              index={index}
              slot={slot}
              awakenerOptions={filteredOptionsBySlot[index]}
              getCachedTags={getCachedTags}
              setCachedTags={setCachedTags}
              onChange={(updated) => handleSlotChange(index, updated)}
            />
          ))}
        </div>

        <div className="w-full shrink-0 lg:sticky lg:top-6 lg:w-80 lg:self-start xl:w-96">
          <SimulatorSidebar
            banList={banList}
            onRemoveBan={handleRemoveBan}
            onClearAllBans={handleClearAllBans}
          />
        </div>
      </div>
    </div>
  );
}
