"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeRelicRanking,
  type RelicRankingResult,
  type RelicTotalCache,
} from "@/lib/path-carver/relic-candidates";
import type { RelicCatalogEntry } from "@/lib/path-carver/relic-manifestations";
import type { TeamData } from "@/lib/team-data/types";
import type {
  RelicRankingInputs,
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

export type RelicRankingState = {
  ranking: RelicRankingResult | null;
  /** True while a ranking for the current team/selection is in flight. */
  computing: boolean;
  error: string | null;
};

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

/**
 * Runs `computeRelicRanking` in a module Web Worker so the main thread never
 * blocks on the per-candidate engine sweep. Falls back to a synchronous
 * main-thread run when Web Workers are unavailable.
 *
 * The ranking is stored with the identity of the request that produced it, so a
 * stale result is ignored (and "computing" stays true) without an effect reset.
 */
export function useRelicRanking({
  teamData,
  relicCatalog,
  damageDealerAwakenerIds,
  selectedRelicIds,
  accountLevel,
  ownedPosseCount,
  hsr,
}: UseRelicRankingArgs): RelicRankingState {
  const [outcome, setOutcome] = useState<RankingOutcome | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const latestRequestIdRef = useRef(0);
  const pendingRef = useRef(new Map<number, RequestContext>());
  const fallbackCacheRef = useRef<RelicTotalCache>(new Map());

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

  // Create the worker once (client-only; effects never run during SSR).
  useEffect(() => {
    if (typeof Worker === "undefined") return;
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("./relic-ranking.worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch {
      return;
    }
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Apply worker responses. Only the newest request is accepted.
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const onMessage = (event: MessageEvent<RelicRankingWorkerResponse>) => {
      const message = event.data;
      if (message.requestId !== latestRequestIdRef.current) return;
      const context = pendingRef.current.get(message.requestId);
      pendingRef.current.delete(message.requestId);
      if (!context) return;
      if (message.type === "ranked") {
        setOutcome({ context, result: message.result });
      } else {
        setOutcome({ context, error: message.message });
      }
    };
    worker.addEventListener("message", onMessage);
    return () => worker.removeEventListener("message", onMessage);
  }, []);

  // New team data ⇒ reset the worker cache and re-seed the closure. This must
  // post before the rank request below (effects run in declaration order).
  useEffect(() => {
    if (teamData == null || relicCatalog == null) return;
    fallbackCacheRef.current = new Map();
    workerRef.current?.postMessage({
      type: "init",
      teamData,
      relicCatalog,
      damageDealerAwakenerIds: [...damageDealerAwakenerIds],
    });
  }, [teamData, relicCatalog, damageDealerAwakenerIds]);

  // Issue a rank request whenever the team/selection/inputs change.
  useEffect(() => {
    if (currentContext == null) return;
    const context = currentContext;
    let cancelled = false;

    const handle = setTimeout(() => {
      if (cancelled) return;
      const requestId = ++requestIdRef.current;
      latestRequestIdRef.current = requestId;
      const inputs: RelicRankingInputs = { accountLevel, ownedPosseCount, hsr };
      const worker = workerRef.current;

      if (worker) {
        worker.postMessage({
          type: "rank",
          requestId,
          selectedRelicIds: [...selectedRelicIds],
          inputs,
        });
        pendingRef.current.set(requestId, context);
        return;
      }

      // No worker available (or construction failed) — degrade to main thread.
      try {
        const result = computeRelicRanking({
          teamData: context.teamData,
          damageDealerAwakenerIds: context.damageDealerAwakenerIds,
          relicCatalog: context.relicCatalog,
          selectedRelicIds,
          inputs,
          totalCache: fallbackCacheRef.current,
        });
        if (requestId !== latestRequestIdRef.current) return;
        setOutcome({ context, result });
      } catch (cause) {
        setOutcome({
          context,
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    currentContext,
    selectedRelicIds,
    accountLevel,
    ownedPosseCount,
    hsr,
  ]);

  const settled =
    outcome != null &&
    currentContext != null &&
    contextMatches(outcome.context, currentContext) &&
    (outcome.result != null || outcome.error != null);
  const ranking =
    settled && outcome?.result != null ? outcome.result : null;
  const error = settled && outcome?.error != null ? outcome.error : null;

  return {
    ranking,
    computing: currentContext != null && !settled,
    error,
  };
}
