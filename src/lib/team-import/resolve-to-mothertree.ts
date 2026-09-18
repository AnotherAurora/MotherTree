import { normalizeNameKey } from "@/lib/gear-audit/constants";
import { createEmptySlots, type SlotState } from "@/lib/simulator/types";
import type {
  DecodedIngameTeam,
  ImportTeamResult,
  IngameImportWarning,
  SkeydbLineupCatalogs,
} from "./types";

export type MotherTreeNameMaps = {
  awakenerByName: Map<string, number>;
  wheelByName: Map<string, number>;
  covenantByName: Map<string, number>;
  posseByName: Map<string, number>;
};

export function buildMotherTreeNameMaps(options: {
  awakeners: readonly { value: number; label: string }[];
  wheels: readonly { value: number; label: string }[];
  covenants: readonly { value: number; label: string }[];
  posses: readonly { value: number; label: string }[];
}): MotherTreeNameMaps {
  function toMap(items: readonly { value: number; label: string }[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(normalizeNameKey(item.label), item.value);
    }
    return map;
  }

  return {
    awakenerByName: toMap(options.awakeners),
    wheelByName: toMap(options.wheels),
    covenantByName: toMap(options.covenants),
    posseByName: toMap(options.posses),
  };
}

function buildSkeydbIdToNameMap(
  catalogs: SkeydbLineupCatalogs,
  kind: keyof SkeydbLineupCatalogs,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const record of catalogs[kind].records) {
    if (record.id && record.name) {
      map.set(record.id, record.name);
    }
  }
  return map;
}

function resolveEntityId(
  skeydbId: string | null,
  skeydbIdToName: Map<string, string>,
  mothertreeByName: Map<string, number>,
  section: IngameImportWarning["section"],
  slotIndex: number | undefined,
  field: IngameImportWarning["field"] | undefined,
  warnings: IngameImportWarning[],
): number | null {
  if (skeydbId == null) {
    return null;
  }

  const name = skeydbIdToName.get(skeydbId);
  if (!name) {
    warnings.push({
      section,
      slotIndex,
      field,
      token: skeydbId,
      reason: "unresolved_name",
      skeydbId,
    });
    return null;
  }

  const mothertreeId = mothertreeByName.get(normalizeNameKey(name));
  if (mothertreeId == null) {
    warnings.push({
      section,
      slotIndex,
      field,
      token: name,
      reason: "unresolved_name",
      skeydbId,
    });
    return null;
  }

  return mothertreeId;
}

export function resolveDecodedTeamToMotherTree(
  decoded: DecodedIngameTeam,
  catalogs: SkeydbLineupCatalogs,
  nameMaps: MotherTreeNameMaps,
): ImportTeamResult {
  const awakenerIdToName = buildSkeydbIdToNameMap(catalogs, "awakeners");
  const wheelIdToName = buildSkeydbIdToNameMap(catalogs, "wheels");
  const covenantIdToName = buildSkeydbIdToNameMap(catalogs, "covenants");
  const posseIdToName = buildSkeydbIdToNameMap(catalogs, "posses");
  const warnings: IngameImportWarning[] = [...decoded.warnings];

  const slots: SlotState[] = createEmptySlots(4).map((empty, index) => {
    const slot = decoded.slots[index];
    if (!slot) {
      return empty;
    }

    return {
      awakenerId: resolveEntityId(
        slot.awakenerId,
        awakenerIdToName,
        nameMaps.awakenerByName,
        "awakener",
        index,
        undefined,
        warnings,
      ),
      wheel1Id: resolveEntityId(
        slot.wheel1Id,
        wheelIdToName,
        nameMaps.wheelByName,
        "wheel",
        index,
        "wheelOne",
        warnings,
      ),
      wheel2Id: resolveEntityId(
        slot.wheel2Id,
        wheelIdToName,
        nameMaps.wheelByName,
        "wheel",
        index,
        "wheelTwo",
        warnings,
      ),
      covenantId: resolveEntityId(
        slot.covenantId,
        covenantIdToName,
        nameMaps.covenantByName,
        "covenant",
        index,
        undefined,
        warnings,
      ),
      covenantStatSetId: null,
      awakenerEnlightenment: empty.awakenerEnlightenment,
    };
  });

  const posseId = resolveEntityId(
    decoded.posseId,
    posseIdToName,
    nameMaps.posseByName,
    "posse",
    undefined,
    undefined,
    warnings,
  );

  return { slots, posseId, warnings };
}

const SURFACEABLE_WARNING_REASONS = new Set<IngameImportWarning["reason"]>([
  "unknown_token",
  "ambiguous_parse",
  "unresolved_name",
]);

function isSurfaceableWarning(warning: IngameImportWarning): boolean {
  return (
    SURFACEABLE_WARNING_REASONS.has(warning.reason) &&
    (warning.section === "awakener" || warning.section === "wheel")
  );
}

/** User-facing summary for awakener/wheel import issues. */
export function formatIngameImportWarningMessage(
  warnings: IngameImportWarning[],
): string | null {
  const surfaced = warnings.filter(isSurfaceableWarning);
  if (surfaced.length === 0) {
    return null;
  }

  const detailParts = surfaced.slice(0, 2).map((warning) => {
    const slotLabel =
      warning.slotIndex === undefined
        ? "unknown slot"
        : `slot ${String(warning.slotIndex + 1)}`;
    if (warning.section === "awakener") {
      return `${slotLabel} awakener`;
    }
    const wheelLabel = warning.field === "wheelTwo" ? "wheel 2" : "wheel 1";
    return `${slotLabel} ${wheelLabel}`;
  });
  const suffix = surfaced.length > 2 ? "; ..." : "";
  const details = detailParts.join("; ");
  const tokenLabel = surfaced.length === 1 ? "piece" : "pieces";

  return `${String(surfaced.length)} awakener/wheel ${tokenLabel} could not be matched and were left empty (${details}${suffix}).`;
}
