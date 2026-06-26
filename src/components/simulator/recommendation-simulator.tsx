"use client";

import { useState } from "react";
import { AwakenerSlotRow } from "@/components/simulator/awakener-slot-row";
import {
  createEmptySlots,
  INITIAL_BAN_LIST,
  type SlotState,
} from "@/components/simulator/mock-data";
import { SimulatorHeader } from "@/components/simulator/simulator-header";
import { SimulatorSidebar } from "@/components/simulator/simulator-sidebar";

export function RecommendationSimulator() {
  const [realm, setRealm] = useState("");
  const [posse, setPosse] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const [slots, setSlots] = useState<SlotState[]>(createEmptySlots);
  const [banList, setBanList] = useState<string[]>([...INITIAL_BAN_LIST]);

  function handleSlotChange(index: number, slot: SlotState) {
    setSlots((prev) => prev.map((s, i) => (i === index ? slot : s)));
  }

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
          UI prototype for simulating the recommendations system. Controls use
          mock data only — simulation logic is not yet wired.
        </p>
      </div>

      <SimulatorHeader
        realm={realm}
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
