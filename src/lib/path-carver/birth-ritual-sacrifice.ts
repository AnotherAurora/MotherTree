import { combineSameTagScalar } from "@/lib/path-carver/combine-same-tag-scalar";
import { isActiveDamageTagName } from "@/lib/path-carver/hit-tentacle-attack";
import type { Tag } from "@/lib/team-data/types";

/** Special.Birth Ritual */
export const SPECIAL_BIRTH_RITUAL_TAG_ID = 54;

/** Attacker.Non-Active Damage.Sacrifice */
export const ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID = 50;

/** Team-wide Birth Ritual stack cap. */
export const MAX_BIRTH_RITUAL = 75;

/** 1 Birth Ritual point → 1% of the damage pool as Sacrifice. */
export const SACRIFICE_RATE_PER_POINT = 0.01;

const TEAM_POOL_OWNER = "*team*";

const BIRTH_RITUAL_CAP_LABEL = "Special.Birth Ritual cap";
const BIRTH_RITUAL_SACRIFICE_LABEL = "Special.Birth Ritual → Sacrifice";

export type BirthRitualSacrificeStep = {
  kind: "special";
  label: string;
  detail: string;
};

type OwnerKey = string;
type OwnerTotals = Map<OwnerKey, Map<number, number>>;

function getOwnerValue(
  ownerValues: OwnerTotals,
  owner: OwnerKey,
  tagId: number,
): number {
  return ownerValues.get(owner)?.get(tagId) ?? 0;
}

function setOwnerValue(
  ownerValues: OwnerTotals,
  owner: OwnerKey,
  tagId: number,
  value: number,
): void {
  let map = ownerValues.get(owner);
  if (!map) {
    map = new Map();
    ownerValues.set(owner, map);
  }
  if (value === 0) {
    map.delete(tagId);
  } else {
    map.set(tagId, value);
  }
}

/** Additive sum of one tag across all owner buckets. */
export function sumTagAcrossOwners(
  ownerValues: OwnerTotals,
  tagId: number,
): number {
  let total = 0;
  for (const map of ownerValues.values()) {
    total += map.get(tagId) ?? 0;
  }
  return total;
}

export type BirthRitualCapResult = {
  rawTotal: number;
  cappedTotal: number;
  capApplied: boolean;
};

/**
 * Cap team-wide Birth Ritual at MAX_BIRTH_RITUAL.
 * When over cap, scale each owner's value proportionally.
 */
export function applyBirthRitualCap(
  ownerValues: OwnerTotals,
): BirthRitualCapResult {
  const parts: { owner: OwnerKey; value: number }[] = [];
  let rawTotal = 0;
  for (const [owner, map] of ownerValues) {
    const value = map.get(SPECIAL_BIRTH_RITUAL_TAG_ID) ?? 0;
    if (value === 0) continue;
    parts.push({ owner, value });
    rawTotal += value;
  }

  const cappedTotal = Math.min(rawTotal, MAX_BIRTH_RITUAL);
  const capApplied = rawTotal > cappedTotal;

  if (capApplied && rawTotal > 0) {
    const scale = cappedTotal / rawTotal;
    for (const { owner, value } of parts) {
      setOwnerValue(
        ownerValues,
        owner,
        SPECIAL_BIRTH_RITUAL_TAG_ID,
        value * scale,
      );
    }
  }

  return { rawTotal, cappedTotal, capApplied };
}

/**
 * Sum finalized Active Damage family + Tentacle values across all owners.
 * Active Damage and converted Tentacle both count (no dedup).
 */
export function sumSacrificeDamagePool(
  ownerValues: OwnerTotals,
  tagsById: Readonly<Record<number, Tag>>,
): number {
  let pool = 0;
  for (const map of ownerValues.values()) {
    for (const [tagId, value] of map) {
      if (value === 0) continue;
      const tag = tagsById[tagId];
      if (!tag) continue;
      if (
        tag.tagName === "Attacker.Tentacle" ||
        isActiveDamageTagName(tag.tagName)
      ) {
        pool += value;
      }
    }
  }
  return pool;
}

/** Sacrifice added from capped Birth Ritual and the damage pool. */
export function computeSacrificeAmount(
  cappedBirthRitual: number,
  damagePool: number,
): number {
  if (cappedBirthRitual <= 0 || damagePool <= 0) return 0;
  return Math.ceil(
    damagePool * cappedBirthRitual * SACRIFICE_RATE_PER_POINT,
  );
}

export type BirthRitualSacrificeResult = {
  rawBirthRitual: number;
  cappedBirthRitual: number;
  capApplied: boolean;
  damagePool: number;
  sacrificeAdded: number;
  sacrificeTotal: number;
};

export type ApplyBirthRitualSacrificeInput = {
  ownerValues: OwnerTotals;
  tagsById: Readonly<Record<number, Tag>>;
};

/**
 * Phase 4e — cap Birth Ritual, convert to Sacrifice on team pool.
 * Mutates ownerValues in place.
 */
export function applyBirthRitualSacrificeConversion(
  input: ApplyBirthRitualSacrificeInput,
): { result: BirthRitualSacrificeResult; steps: BirthRitualSacrificeStep[] } {
  const { ownerValues, tagsById } = input;
  const steps: BirthRitualSacrificeStep[] = [];

  const { rawTotal, cappedTotal, capApplied } =
    applyBirthRitualCap(ownerValues);

  if (capApplied) {
    steps.push({
      kind: "special",
      label: BIRTH_RITUAL_CAP_LABEL,
      detail:
        `raw=${rawTotal} capped=${cappedTotal} scale=${cappedTotal / rawTotal}`,
    });
  }

  const damagePool = sumSacrificeDamagePool(ownerValues, tagsById);
  const sacrificeAdded = computeSacrificeAmount(cappedTotal, damagePool);

  const sacrificeTag = tagsById[ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID];
  const existingSacrifice = getOwnerValue(
    ownerValues,
    TEAM_POOL_OWNER,
    ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID,
  );
  const sacrificeTotal =
    sacrificeAdded === 0
      ? existingSacrifice
      : combineSameTagScalar(
          existingSacrifice === 0 ? undefined : existingSacrifice,
          sacrificeAdded,
          sacrificeTag?.isAdditive !== false,
          sacrificeTag?.isPercent === true,
        );

  if (sacrificeAdded !== 0) {
    setOwnerValue(
      ownerValues,
      TEAM_POOL_OWNER,
      ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID,
      sacrificeTotal,
    );
  }

  if (cappedTotal > 0 || sacrificeAdded > 0) {
    steps.push({
      kind: "special",
      label: BIRTH_RITUAL_SACRIFICE_LABEL,
      detail:
        `birthRitual=${cappedTotal} damagePool=${damagePool}` +
        ` rate=1%/pt sacrifice=${sacrificeAdded}` +
        (existingSacrifice !== 0 && sacrificeAdded !== 0
          ? ` total=${sacrificeTotal}`
          : ""),
    });
  }

  return {
    result: {
      rawBirthRitual: rawTotal,
      cappedBirthRitual: cappedTotal,
      capApplied,
      damagePool,
      sacrificeAdded,
      sacrificeTotal,
    },
    steps,
  };
}
