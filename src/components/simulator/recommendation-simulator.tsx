"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildAwakenerOptionMap,
  filterAwakenerOptionsForSlot,
  formatSelectedRealms,
} from "@/components/simulator/awakener-selection";
import { AwakenerSlotRow } from "@/components/simulator/awakener-slot-row";
import { createEmptySlots, type SlotState } from "@/components/simulator/mock-data";
import { SimulatorHeader } from "@/components/simulator/simulator-header";
import { SimulatorSidebar } from "@/components/simulator/simulator-sidebar";
import { StartFlowModal } from "@/components/simulator/start-flow-modal";
import { computeFulfillment, type FulfillmentResult } from "@/lib/simulator/fulfillment";
import { loadTeamData, type TeamData } from "@/lib/actions/team-data";
import {
  getDesireDetail,
  runGenerateTeamForDesire,
  runRecommendEmptySlots,
  type BanEntry,
  type DesireDetail,
  type SimulatorGearOptions,
} from "@/lib/actions/simulator-flow";
import type {
  AwakenerRelatedTags,
  SimulatorAwakenerOption,
} from "@/lib/actions/simulator";

type RecommendationSimulatorProps = {
  awakenerOptions: SimulatorAwakenerOption[];
  gearOptions: SimulatorGearOptions;
};

export function RecommendationSimulator({
  awakenerOptions,
  gearOptions,
}: RecommendationSimulatorProps) {
  const [posseId, setPosseId] = useState<number | null>(null);
  const [path, setPath] = useState("");
  const [selectedDesireId, setSelectedDesireId] = useState<number | null>(null);
  const [desireDetail, setDesireDetail] = useState<DesireDetail | null>(null);
  const [slots, setSlots] = useState<SlotState[]>(() => createEmptySlots());
  const [banList, setBanList] = useState<BanEntry[]>([]);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [teamDataError, setTeamDataError] = useState<string | null>(null);
  const [loadingTeamData, setLoadingTeamData] = useState(false);
  const [loadingFlow, setLoadingFlow] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [fulfillment, setFulfillment] = useState<FulfillmentResult | null>(null);
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

  const loadTeamDataDisabled = useMemo(
    () => !slots.some((slot) => slot.awakenerId != null),
    [slots],
  );

  const recommendDisabled = useMemo(() => {
    const hasEmptyAwakener = slots.some((slot) => slot.awakenerId == null);
    const hasEmptyGear = slots.some(
      (slot) =>
        slot.awakenerId != null &&
        (slot.covenantId == null ||
          slot.wheel1Id == null ||
          slot.wheel2Id == null),
    );
    return !(hasEmptyAwakener || posseId == null || hasEmptyGear);
  }, [slots, posseId]);

  const updateFulfillment = useCallback(
    (data: TeamData | null, detail: DesireDetail | null) => {
      if (!data || !detail) {
        setFulfillment(null);
        return;
      }
      setFulfillment(computeFulfillment(data.manifestations, detail.demands));
    },
    [],
  );

  const handleLoadTeamData = useCallback(
    async (
      slotsInput: SlotState[] = slots,
      posseInput: number | null = posseId,
      detail: DesireDetail | null = desireDetail,
    ) => {
      setLoadingTeamData(true);
      setTeamDataError(null);

      const result = await loadTeamData({
        slots: slotsInput.map((slot) => ({
          awakenerId: slot.awakenerId,
          covenantId: slot.covenantId,
          wheel1Id: slot.wheel1Id,
          wheel2Id: slot.wheel2Id,
        })),
        posseId: posseInput,
      });

      setLoadingTeamData(false);

      if (result.success) {
        setTeamData(result.data);
        updateFulfillment(result.data, detail);
      } else {
        setTeamData(null);
        setFulfillment(null);
        setTeamDataError(result.error);
      }
    },
    [slots, posseId, desireDetail, updateFulfillment],
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
    setSelectedDesireId(null);
    setDesireDetail(null);
    setSlots(createEmptySlots());
    setPosseId(null);
    setTeamData(null);
    setTeamDataError(null);
    setFulfillment(null);
    setFlowError(null);
  }

  function handleAddBan(entry: BanEntry) {
    setBanList((prev) => {
      const key = `${entry.entityType}:${entry.entityId}`;
      if (prev.some((b) => `${b.entityType}:${b.entityId}` === key)) {
        return prev;
      }
      return [...prev, entry];
    });
  }

  function handleRemoveBan(entry: BanEntry) {
    setBanList((prev) =>
      prev.filter(
        (b) =>
          !(
            b.entityType === entry.entityType && b.entityId === entry.entityId
          ),
      ),
    );
  }

  function handleClearAllBans() {
    setBanList([]);
  }

  async function handleStartConfirm(startAwakenerId: number, desireId: number) {
    setLoadingFlow(true);
    setFlowError(null);

    const [detailResult, generateResult] = await Promise.all([
      getDesireDetail(desireId),
      runGenerateTeamForDesire({
        desireId,
        startAwakenerId,
        banEntries: banList,
      }),
    ]);

    if (!detailResult.success) {
      setLoadingFlow(false);
      setFlowError(detailResult.error);
      return;
    }

    if (!generateResult.success) {
      setLoadingFlow(false);
      setFlowError(generateResult.error);
      return;
    }

    setSelectedDesireId(desireId);
    setDesireDetail(detailResult.data);
    setSlots(generateResult.data.slots);
    setPosseId(generateResult.data.posseId);
    setPath(generateResult.data.desireName);
    setStartModalOpen(false);
    setLoadingFlow(false);
    await handleLoadTeamData(
      generateResult.data.slots,
      generateResult.data.posseId,
      detailResult.data,
    );
  }

  async function handleRecommend() {
    if (selectedDesireId == null) return;

    setLoadingFlow(true);
    setFlowError(null);

    const result = await runRecommendEmptySlots({
      desireId: selectedDesireId,
      slots,
      posseId,
      banEntries: banList,
    });

    setLoadingFlow(false);

    if (!result.success) {
      setFlowError(result.error);
      return;
    }

    setSlots(result.data.slots);
    setPosseId(result.data.posseId);
    await handleLoadTeamData(
      result.data.slots,
      result.data.posseId,
      desireDetail,
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Recommendation Simulator Debugger
        </h1>
        <p className="mt-2 text-zinc-600">
          Start a path to generate a team, then tune slots and recommend empty
          gear. Radar and summary reflect live tag fulfillment against desire
          demands.
        </p>
      </div>

      {flowError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {flowError}
        </div>
      ) : null}

      <SimulatorHeader
        realm={realmDisplay}
        posseId={posseId}
        path={path}
        gearOptions={gearOptions}
        onPosseChange={setPosseId}
        onStart={() => setStartModalOpen(true)}
        onRecommend={handleRecommend}
        onClearPath={handleClearPath}
        onLoadTeamData={() => void handleLoadTeamData()}
        loadingTeamData={loadingTeamData}
        loadTeamDataDisabled={loadTeamDataDisabled}
        loadingFlow={loadingFlow}
        recommendDisabled={recommendDisabled}
        hasSelectedDesire={selectedDesireId != null}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-[2] flex-col gap-4">
          {slots.map((slot, index) => (
            <AwakenerSlotRow
              key={index}
              index={index}
              slot={slot}
              awakenerOptions={filteredOptionsBySlot[index]}
              gearOptions={gearOptions}
              getCachedTags={getCachedTags}
              setCachedTags={setCachedTags}
              onChange={(updated) => handleSlotChange(index, updated)}
            />
          ))}
        </div>

        <div className="w-full shrink-0 lg:sticky lg:top-6 lg:w-80 lg:self-start xl:w-96">
          <SimulatorSidebar
            banList={banList}
            awakenerOptions={awakenerOptions}
            gearOptions={gearOptions}
            onAddBan={handleAddBan}
            onRemoveBan={handleRemoveBan}
            onClearAllBans={handleClearAllBans}
            teamData={teamData}
            teamDataError={teamDataError}
            fulfillment={fulfillment}
            bannedEntityCount={banList.length}
          />
        </div>
      </div>

      <StartFlowModal
        open={startModalOpen}
        onOpenChange={setStartModalOpen}
        awakenerOptions={awakenerOptions}
        onConfirm={handleStartConfirm}
        loading={loadingFlow}
      />
    </div>
  );
}
