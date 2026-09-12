import {
  computeRelicRanking,
  type RelicRankingResult,
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
      type: "rank";
      requestId: number;
      selectedRelicIds: number[];
      inputs: RelicRankingInputs;
    };

export type RelicRankingWorkerResponse =
  | { type: "ranked"; requestId: number; result: RelicRankingResult }
  | { type: "error"; requestId: number; message: string };

type WorkerScope = {
  onmessage: ((event: MessageEvent<RelicRankingWorkerRequest>) => void) | null;
  postMessage: (message: RelicRankingWorkerResponse) => void;
};

const scope = self as unknown as WorkerScope;

let teamData: TeamData | null = null;
let relicCatalog: RelicCatalogEntry[] = [];
let damageDealerAwakenerIds: number[] = [];
let totalCache: RelicTotalCache = new Map();

scope.onmessage = (event) => {
  const message = event.data;

  if (message.type === "init") {
    teamData = message.teamData;
    relicCatalog = message.relicCatalog;
    damageDealerAwakenerIds = message.damageDealerAwakenerIds;
    // New team ⇒ cached totals are no longer valid.
    totalCache = new Map();
    return;
  }

  try {
    if (teamData == null) throw new Error("Ranking worker not initialized");
    const result = computeRelicRanking({
      teamData,
      damageDealerAwakenerIds,
      relicCatalog,
      selectedRelicIds: message.selectedRelicIds,
      inputs: message.inputs,
      totalCache,
    });
    scope.postMessage({
      type: "ranked",
      requestId: message.requestId,
      result,
    });
  } catch (error) {
    scope.postMessage({
      type: "error",
      requestId: message.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
