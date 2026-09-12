import {
  computeEligibleRelicEntries,
  computeRelicCandidateTotals,
  createRelicRankingContext,
  type RelicCandidateTotalRow,
  type RelicRankingContext,
  type RelicTotalCache,
} from "@/lib/path-carver/relic-candidates";
import type { RelicCatalogEntry } from "@/lib/path-carver/relic-manifestations";
import type { TeamData } from "@/lib/team-data/types";

export type RelicRankingInputs = {
  accountLevel: number;
  ownedPosseCount: number;
  hsr: boolean;
};

export type RelicRankingWorkerRequest =
  | {
      type: "init";
      teamData: TeamData;
      relicCatalog: RelicCatalogEntry[];
      damageDealerAwakenerIds: number[];
    }
  | {
      type: "rankChunk";
      /** Sweep generation; responses from superseded sweeps are ignored. */
      generation: number;
      requestId: number;
      selectedRelicIds: number[];
      candidateRelicIds: number[];
      inputs: RelicRankingInputs;
      includeBaseline: boolean;
    };

export type RelicRankingWorkerResponse =
  | {
      type: "chunk";
      generation: number;
      requestId: number;
      /** Present only when `includeBaseline` was requested. */
      baselineTotal: number | null;
      eligibleIds: number[];
      rows: RelicCandidateTotalRow[];
    }
  | {
      type: "error";
      generation: number;
      requestId: number;
      message: string;
    };

type WorkerScope = {
  onmessage: ((event: MessageEvent<RelicRankingWorkerRequest>) => void) | null;
  postMessage: (message: RelicRankingWorkerResponse) => void;
};

const scope = self as unknown as WorkerScope;

let context: RelicRankingContext | null = null;
let relicCatalog: RelicCatalogEntry[] = [];
let totalCache: RelicTotalCache = new Map();

scope.onmessage = (event) => {
  const message = event.data;

  if (message.type === "init") {
    context = createRelicRankingContext(
      message.teamData,
      message.damageDealerAwakenerIds,
    );
    relicCatalog = message.relicCatalog;
    // New team ⇒ cached totals are no longer valid.
    totalCache = new Map();
    return;
  }

  try {
    if (context == null) throw new Error("Ranking worker not initialized");
    const eligible = computeEligibleRelicEntries(
      context.applyContext,
      relicCatalog,
      message.selectedRelicIds,
    );
    const eligibleIds = eligible.map((entry) => entry.relicId);
    const result = computeRelicCandidateTotals({
      teamData: context.teamData,
      applyContext: context.applyContext,
      relicCatalog,
      eligibleRelicIds: eligibleIds,
      selectedRelicIds: message.selectedRelicIds,
      candidateRelicIds: message.candidateRelicIds,
      inputs: message.inputs,
      totalCache,
      includeBaseline: message.includeBaseline,
    });
    scope.postMessage({
      type: "chunk",
      generation: message.generation,
      requestId: message.requestId,
      baselineTotal: result.baselineTotal,
      eligibleIds: result.eligible.map((entry) => entry.relicId),
      rows: result.rows,
    });
  } catch (error) {
    scope.postMessage({
      type: "error",
      generation: message.generation,
      requestId: message.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
