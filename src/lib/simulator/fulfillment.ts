import { aggregateTagTotals } from "@/lib/simulator/aggregate-tags";
import { matchesDemandTag } from "@/lib/simulator/tag-matching";
import { rollupTagValue } from "@/lib/simulator/tag-matching";
import type { DesireDemandRow } from "@/lib/simulator/types";
import type { Manifestation } from "@/lib/team-data/types";

export type DemandFulfillment = {
  demandId: number;
  tagName: string;
  actualValue: number;
  targetValue: number;
  fulfillmentPct: number;
  basePriorityWeight: number;
  curve: string | null;
  contributingTags: string[];
};

export type FulfillmentResult = {
  demands: DemandFulfillment[];
  weightedScore: number;
  summaryLines: string[];
};

function contributingTagsForDemand(
  teamTagTotals: Map<string, number>,
  demandTag: string,
): string[] {
  const tags: string[] = [];
  for (const [tagName, value] of teamTagTotals) {
    if (value > 0 && matchesDemandTag(tagName, demandTag)) {
      tags.push(`${tagName}=${value}`);
    }
  }
  return tags.sort();
}

/**
 * Curve formulas (Phase 1 approximations for tuning via radar):
 * - linear: min(100, actual/target * 100)
 * - logarithmic: 100 * (1 - exp(-decayRate * actual / target))
 * - exponential: min(100, 100 * (actual/target)^decayRate)
 */
export function fulfillmentPct(
  actual: number,
  target: number,
  curve: DesireDemandRow["curve"],
  decayRate: number,
): number {
  if (target <= 0) return actual > 0 ? 100 : 0;
  const ratio = actual / target;
  const rate = decayRate > 0 ? decayRate : 1;

  switch (curve) {
    case "linear":
      return Math.min(100, ratio * 100);
    case "logarithmic":
      return Math.min(100, 100 * (1 - Math.exp((-rate * actual) / target)));
    case "exponential":
      return Math.min(100, 100 * Math.pow(Math.max(0, ratio), rate));
    default:
      return Math.min(100, ratio * 100);
  }
}

export function computeFulfillment(
  manifestations: Manifestation[],
  demands: DesireDemandRow[],
): FulfillmentResult {
  const teamTagTotals = aggregateTagTotals(manifestations);

  const demandResults: DemandFulfillment[] = demands.map((demand) => {
    const actualValue = rollupTagValue(teamTagTotals, demand.tagName);
    const pct = fulfillmentPct(
      actualValue,
      demand.targetValue,
      demand.curve,
      demand.decayRate,
    );
    return {
      demandId: demand.id,
      tagName: demand.tagName,
      actualValue,
      targetValue: demand.targetValue,
      fulfillmentPct: pct,
      basePriorityWeight: demand.basePriorityWeight,
      curve: demand.curve,
      contributingTags: contributingTagsForDemand(
        teamTagTotals,
        demand.tagName,
      ),
    };
  });

  const weightedScore = demandResults.reduce(
    (sum, d) => sum + d.basePriorityWeight * (d.fulfillmentPct / 100),
    0,
  );

  const summaryLines = [
    ...demandResults.map(
      (d) =>
        `${d.tagName}: ${d.actualValue.toFixed(2)}/${d.targetValue} → ${d.fulfillmentPct.toFixed(1)}% (${d.curve ?? "linear"})`,
    ),
    `Total weighted score: ${weightedScore.toFixed(2)}`,
  ];

  return { demands: demandResults, weightedScore, summaryLines };
}
