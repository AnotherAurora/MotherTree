"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  compareRelicRankingRows,
  computeEligibleRelicEntries,
  computeRelicRanking,
  createRelicRankingContext,
  relicSelectionKey,
  relicValueInputsKey,
  type RelicRankingResult,
  type RelicRankingRow,
  type RelicTotalCache,
} from "@/lib/path-carver/relic-candidates";
import type { RelicCatalogEntry } from "@/lib/path-carver/relic-manifestations";
import type { TeamData } from "@/lib/team-data/types";
import type {
  RelicRankingInputs,
  RelicRankingWorkerRequest,
  RelicRankingWorkerResponse,
} from "@/components/relic-picker/relic-ranking.worker";

type UseRelicRankingArgs = {
  teamData: TeamData | null;
  relicCatalog: RelicCatalogEntry[] | null;
  damageDealerAwakenerIds: readonly number[];
  selectedRelicIds: readonly number[];
  accountLevel: number;
  ownedPosseCount: number;
  hsr: boolean;
  /**
   * When false, the sweep only runs on demand through `recalculate`; team,
   * selection, and input changes do not trigger a recompute.
   */
  autoUpdate: boolean;
};

/** Identity of the team + selection + inputs a ranking was computed for. */
type RequestContext = {
  teamData: TeamData;
  relicCatalog: RelicCatalogEntry[];
  damageDealerAwakenerIds: readonly number[];
  selectedKey: string;
  inputsKey: string;
};

type RankingOutcome = {
  context: RequestContext;
  result?: RelicRankingResult;
  error?: string;
};

type SweepPlan = {
  generation: number;
  context: RequestContext;
  selectedRelicIds: readonly number[];
  inputs: RelicRankingInputs;
  outputsKey: string;
  eligible: RelicCatalogEntry[];
  rows: Map<number, number>;
  baselineTotal: number | null;
  outstanding: number;
};

type SweepRequest = {
  context: RequestContext;
  selectedRelicIds: readonly number[];
  inputs: RelicRankingInputs;
};

export type RelicRankingProgress = {
  done: number;
  total: number;
};

export type RelicRankingState = {
  ranking: RelicRankingResult | null;
  /** True while a ranking for the current team/selection is in flight. */
  computing: boolean;
  /** True when the displayed ranking predates the current team/selection. */
  stale: boolean;
  /** Recompute the ranking for the current team/selection on demand. */
  recalculate: () => void;
  /** Eligible relics evaluated so far in the in-flight sweep. */
  progress: RelicRankingProgress | null;
  error: string | null;
};

const MAX_WORKERS = 8;

function workerCount(): number {
  if (typeof navigator === "undefined") return 1;
  const hc = navigator.hardwareConcurrency;
  if (hc == null || hc < 2) return 1;
  return Math.max(1, Math.min(MAX_WORKERS, hc - 1));
}

function selectionKeyOf(selectedRelicIds: readonly number[]): string {
  return [...selectedRelicIds].sort((a, b) => a - b).join(",");
}

function inputsKeyOf(
  accountLevel: number,
  ownedPosseCount: number,
  hsr: boolean,
): string {
  return `${accountLevel}:${ownedPosseCount}:${hsr ? 1 : 0}`;
}

function contextMatches(
  context: RequestContext,
  current: RequestContext,
): boolean {
  return (
    context.teamData === current.teamData &&
    context.relicCatalog === current.relicCatalog &&
    context.damageDealerAwakenerIds === current.damageDealerAwakenerIds &&
    context.selectedKey === current.selectedKey &&
    context.inputsKey === current.inputsKey
  );
}

function buildRanking(plan: SweepPlan): RelicRankingResult {
  const baseline = plan.baselineTotal ?? 0;
  const ranked: RelicRankingRow[] = [];
  for (const entry of plan.eligible) {
    const total = plan.rows.get(entry.relicId);
    if (total == null) continue;
    ranked.push({
      entry,
      total,
      percentIncrease:
        baseline > 0 ? ((total - baseline) / baseline) * 100 : null,
    });
  }
  ranked.sort(compareRelicRankingRows);
  return { eligible: plan.eligible, baselineTotal: baseline, ranked };
}

/**
 * Runs the per-candidate engine sweep across a persistent pool of Web Workers
 * so the main thread never blocks. Candidates are sharded, each worker keeps its
 * own total cache, and the main thread mirrors returned totals (`selectionKey →
 * total`) so the just-picked relic becomes the next baseline for free.
 *
 * Results stream in as chunks land (progressive). Falls back to a synchronous
 * main-thread run when Web Workers are unavailable. Honors manual mode: with
 * `autoUpdate` off, only `recalculate()` starts a sweep.
 */
export function useRelicRanking({
  teamData,
  relicCatalog,
  damageDealerAwakenerIds,
  selectedRelicIds,
  accountLevel,
  ownedPosseCount,
  hsr,
  autoUpdate,
}: UseRelicRankingArgs): RelicRankingState {
  const [outcome, setOutcome] = useState<RankingOutcome | null>(null);
  const [live, setLive] = useState<{
    context: RequestContext;
    result: RelicRankingResult;
  } | null>(null);
  const [progress, setProgress] = useState<RelicRankingProgress | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [manualToken, setManualToken] = useState(0);

  const workersRef = useRef<Worker[]>([]);
  const messageHandlerRef = useRef<(message: RelicRankingWorkerResponse) => void>(
    () => {},
  );
  const generationRef = useRef(0);
  const requestIdRef = useRef(0);
  const mirrorRef = useRef<RelicTotalCache>(new Map());
  const fallbackCacheRef = useRef<RelicTotalCache>(new Map());
  const planRef = useRef<SweepPlan | null>(null);
  const runningRef = useRef(false);
  const pendingRef = useRef<SweepRequest | null>(null);
  const handledManualTokenRef = useRef(0);
  const startSweepRef = useRef<
    (
      context: RequestContext,
      selectedRelicIds: readonly number[],
      inputs: RelicRankingInputs,
    ) => void
  >(() => {});

  const recalculate = useCallback(() => {
    setManualToken((token) => token + 1);
  }, []);

  const selectedKey = selectionKeyOf(selectedRelicIds);
  const inputsKey = inputsKeyOf(accountLevel, ownedPosseCount, hsr);
  const currentContext = useMemo<RequestContext | null>(() => {
    if (teamData == null || relicCatalog == null) return null;
    return {
      teamData,
      relicCatalog,
      damageDealerAwakenerIds,
      selectedKey,
      inputsKey,
    };
  }, [
    teamData,
    relicCatalog,
    damageDealerAwakenerIds,
    selectedKey,
    inputsKey,
  ]);

  const publishLive = useCallback((plan: SweepPlan) => {
    setProgress({ done: plan.rows.size, total: plan.eligible.length });
    if (plan.rows.size === 0 && plan.baselineTotal == null) return;
    setLive({ context: plan.context, result: buildRanking(plan) });
  }, []);

  const finishSweep = useCallback(
    (plan: SweepPlan, error?: string) => {
      if (planRef.current !== plan) return;
      planRef.current = null;
      runningRef.current = false;
      setOutcome(
        error != null
          ? { context: plan.context, error }
          : { context: plan.context, result: buildRanking(plan) },
      );
      setLive(null);
      setProgress(null);
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) {
        // Chain the latest queued request instead of piling onto busy workers.
        startSweepRef.current(
          pending.context,
          pending.selectedRelicIds,
          pending.inputs,
        );
      } else {
        setInFlight(false);
      }
    },
    [],
  );

  const handleWorkerMessage = useCallback(
    (message: RelicRankingWorkerResponse) => {
      const plan = planRef.current;
      if (plan == null || message.generation !== plan.generation) return;

      if (message.type === "error") {
        finishSweep(plan, message.message);
        return;
      }

      // The worker resolves the realm/relevance-eligible set. When the (gated)
      // relevance filter is off this matches the main-thread list; reconcile
      // defensively so the displayed eligible set stays exact if it is enabled.
      if (plan.eligible.length !== message.eligibleIds.length) {
        const byRelicId = new Map(
          plan.context.relicCatalog.map((entry) => [entry.relicId, entry]),
        );
        plan.eligible = message.eligibleIds
          .map((relicId) => byRelicId.get(relicId))
          .filter((entry): entry is RelicCatalogEntry => entry != null);
      }

      if (message.baselineTotal != null && plan.baselineTotal == null) {
        plan.baselineTotal = message.baselineTotal;
        mirrorRef.current.set(
          `${plan.outputsKey}|${relicSelectionKey(plan.selectedRelicIds)}`,
          message.baselineTotal,
        );
      }
      for (const row of message.rows) {
        plan.rows.set(row.relicId, row.total);
        mirrorRef.current.set(
          `${plan.outputsKey}|${relicSelectionKey([
            ...plan.selectedRelicIds,
            row.relicId,
          ])}`,
          row.total,
        );
      }
      plan.outstanding -= 1;
      if (plan.outstanding <= 0) {
        finishSweep(plan);
      } else {
        publishLive(plan);
      }
    },
    [finishSweep, publishLive],
  );

  const startSweep = useCallback(
    (
      context: RequestContext,
      selectedRelicIds: readonly number[],
      inputs: RelicRankingInputs,
    ) => {
      if (runningRef.current) {
        pendingRef.current = { context, selectedRelicIds, inputs };
        setInFlight(true);
        return;
      }

      const { teamData, relicCatalog, damageDealerAwakenerIds } = context;
      const generation = ++generationRef.current;
      const outputsKey = relicValueInputsKey(inputs);
      const { applyContext } = createRelicRankingContext(
        teamData,
        damageDealerAwakenerIds,
      );
      const eligible = computeEligibleRelicEntries(
        applyContext,
        relicCatalog,
        selectedRelicIds,
      );

      // No damage dealer ⇒ nothing to calculate; zero baseline, blank impact.
      if (damageDealerAwakenerIds.length === 0) {
        setOutcome({
          context,
          result: {
            eligible,
            baselineTotal: 0,
            ranked: eligible.map((entry) => ({
              entry,
              total: 0,
              percentIncrease: null,
            })),
          },
        });
        setLive(null);
        setProgress(null);
        setInFlight(false);
        return;
      }

      const rows = new Map<number, number>();
      const missing: RelicCatalogEntry[] = [];
      for (const entry of eligible) {
        const key = `${outputsKey}|${relicSelectionKey([
          ...selectedRelicIds,
          entry.relicId,
        ])}`;
        const cached = mirrorRef.current.get(key);
        if (cached != null) rows.set(entry.relicId, cached);
        else missing.push(entry);
      }
      const baselineCached = mirrorRef.current.get(
        `${outputsKey}|${relicSelectionKey(selectedRelicIds)}`,
      );

      const plan: SweepPlan = {
        generation,
        context,
        selectedRelicIds: [...selectedRelicIds],
        inputs,
        outputsKey,
        eligible,
        rows,
        baselineTotal: baselineCached ?? null,
        outstanding: 0,
      };
      planRef.current = plan;
      runningRef.current = true;
      setInFlight(true);

      const needBaseline = baselineCached == null;
      if (missing.length === 0 && !needBaseline) {
        finishSweep(plan);
        return;
      }

      const workers = workersRef.current;
      if (workers.length === 0) {
        // No worker available — degrade to a synchronous main-thread run.
        try {
          const result = computeRelicRanking({
            teamData,
            damageDealerAwakenerIds,
            relicCatalog,
            selectedRelicIds,
            inputs,
            totalCache: fallbackCacheRef.current,
          });
          planRef.current = null;
          runningRef.current = false;
          setOutcome({ context, result });
        } catch (cause) {
          planRef.current = null;
          runningRef.current = false;
          setOutcome({
            context,
            error: cause instanceof Error ? cause.message : String(cause),
          });
        } finally {
          setLive(null);
          setProgress(null);
          setInFlight(false);
        }
        return;
      }

      // Balance by manifestation count (longest-processing-time first).
      const ordered = [...missing].sort(
        (a, b) => b.manifestations.length - a.manifestations.length,
      );
      const chunkCount = workers.length;
      const chunks: RelicCatalogEntry[][] = Array.from(
        { length: chunkCount },
        () => [],
      );
      ordered.forEach((entry, index) => {
        chunks[index % chunkCount].push(entry);
      });

      const jobs: {
        worker: Worker;
        candidateRelicIds: number[];
        includeBaseline: boolean;
      }[] = [];
      if (needBaseline) {
        let bestIndex = 0;
        for (let i = 1; i < chunks.length; i += 1) {
          if (chunks[i].length < chunks[bestIndex].length) bestIndex = i;
        }
        jobs.push({
          worker: workers[bestIndex],
          candidateRelicIds: chunks[bestIndex].map((entry) => entry.relicId),
          includeBaseline: true,
        });
        chunks[bestIndex] = [];
      }
      chunks.forEach((chunk, index) => {
        if (chunk.length === 0) return;
        jobs.push({
          worker: workers[index],
          candidateRelicIds: chunk.map((entry) => entry.relicId),
          includeBaseline: false,
        });
      });

      plan.outstanding = jobs.length;
      publishLive(plan);
      for (const job of jobs) {
        const requestId = ++requestIdRef.current;
        const message: RelicRankingWorkerRequest = {
          type: "rankChunk",
          generation,
          requestId,
          selectedRelicIds: [...plan.selectedRelicIds],
          candidateRelicIds: job.candidateRelicIds,
          inputs,
          includeBaseline: job.includeBaseline,
        };
        job.worker.postMessage(message);
      }
    },
    [finishSweep, publishLive],
  );

  const requestSweep = useCallback(
    (context: RequestContext, selected: readonly number[], inputs: RelicRankingInputs) => {
      if (runningRef.current) {
        pendingRef.current = {
          context,
          selectedRelicIds: selected,
          inputs,
        };
        setInFlight(true);
        return;
      }
      startSweepRef.current(context, selected, inputs);
    },
    [],
  );

  useEffect(() => {
    startSweepRef.current = startSweep;
  }, [startSweep]);

  // Create the worker pool once (client-only; effects never run during SSR).
  useEffect(() => {
    if (typeof Worker === "undefined") return;
    const count = workerCount();
    const workers: Worker[] = [];
    try {
      for (let i = 0; i < count; i += 1) {
        workers.push(
          new Worker(new URL("./relic-ranking.worker.ts", import.meta.url), {
            type: "module",
          }),
        );
      }
    } catch {
      for (const worker of workers) worker.terminate();
      return;
    }
    const onMessage = (event: MessageEvent<RelicRankingWorkerResponse>) => {
      messageHandlerRef.current(event.data);
    };
    for (const worker of workers) worker.addEventListener("message", onMessage);
    workersRef.current = workers;
    return () => {
      for (const worker of workers) {
        worker.removeEventListener("message", onMessage);
        worker.terminate();
      }
      workersRef.current = [];
    };
  }, []);

  useEffect(() => {
    messageHandlerRef.current = handleWorkerMessage;
  }, [handleWorkerMessage]);

  // New team data ⇒ reset caches, cancel any in-flight sweep, re-seed workers.
  useEffect(() => {
    if (teamData == null || relicCatalog == null) return;
    mirrorRef.current = new Map();
    fallbackCacheRef.current = new Map();
    generationRef.current += 1;
    planRef.current = null;
    runningRef.current = false;
    pendingRef.current = null;
    // The abandoned sweep never settles, so clear the busy flag explicitly;
    // stale live/progress snapshots stop matching the new context on their own.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- required on team change
    setInFlight(false);
    const message: RelicRankingWorkerRequest = {
      type: "init",
      teamData,
      relicCatalog,
      damageDealerAwakenerIds: [...damageDealerAwakenerIds],
    };
    for (const worker of workersRef.current) worker.postMessage(message);
  }, [teamData, relicCatalog, damageDealerAwakenerIds]);

  // Issue a sweep whenever the team/selection/inputs change (auto mode), or on
  // demand when `recalculate` is called (manual mode).
  useEffect(() => {
    if (currentContext == null) return;

    const isManual = manualToken !== handledManualTokenRef.current;
    if (isManual) {
      handledManualTokenRef.current = manualToken;
    } else if (!autoUpdate) {
      // Manual mode: context changes must not trigger a sweep on their own.
      return;
    }

    const handle = setTimeout(() => {
      requestSweep(currentContext, selectedRelicIds, {
        accountLevel,
        ownedPosseCount,
        hsr,
      });
    }, 0);
    return () => clearTimeout(handle);
  }, [
    currentContext,
    autoUpdate,
    manualToken,
    selectedRelicIds,
    accountLevel,
    ownedPosseCount,
    hsr,
    requestSweep,
  ]);

  const isCurrent =
    outcome != null &&
    currentContext != null &&
    contextMatches(outcome.context, currentContext) &&
    (outcome.result != null || outcome.error != null);
  const computing =
    inFlight || (autoUpdate && currentContext != null && !isCurrent);
  const stale =
    !autoUpdate && currentContext != null && outcome != null && !isCurrent;
  const liveForCurrent =
    live != null &&
    currentContext != null &&
    contextMatches(live.context, currentContext);
  const ranking =
    outcome?.result != null && (isCurrent || !autoUpdate)
      ? outcome.result
      : live != null && liveForCurrent
        ? live.result
        : null;
  const error =
    outcome?.error != null && (isCurrent || !autoUpdate) ? outcome.error : null;

  return {
    ranking,
    computing,
    stale,
    recalculate,
    progress: computing ? progress : null,
    error,
  };
}
