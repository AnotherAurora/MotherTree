import { resolveRelicValueScalar } from "@/lib/path-carver/relic-research-curve";
import type {
  RelicCatalogEntry,
  RelicValueInputs,
} from "@/lib/path-carver/relic-manifestations";

export type RelicTooltipRow = {
  /** Absolute scalar the engine applies for the current account/posse/HSR. */
  value: number;
  tagName: string;
  /** Stored scalar is a fraction displayed as percent points (×100 + `%`). */
  isPercent: boolean;
};

/**
 * Resolve a relic's manifestation rows to the exact scalars the engine applies
 * (same `resolveRelicValueScalar` call as `buildRelicManifestations`), for the
 * Relic Picker tooltip. Pure and O(rows); independent of the ranking sweep.
 */
export function resolveRelicTooltipRows(
  entry: RelicCatalogEntry,
  inputs: RelicValueInputs,
): RelicTooltipRow[] {
  return entry.manifestations.map((row) => ({
    value: resolveRelicValueScalar({
      kind: row.kind,
      baseFormula: row.baseFormula,
      valueScalar: row.valueScalar,
      accountLevel: inputs.accountLevel,
      ownedPosseCount: inputs.ownedPosseCount,
      hsr: inputs.hsr,
    }),
    tagName: row.tagName,
    isPercent: row.isPercent,
  }));
}
