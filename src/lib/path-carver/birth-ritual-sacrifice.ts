import { combineSameTagScalar } from "@/lib/path-carver/combine-same-tag-scalar";
import { isActiveDamageTagName } from "@/lib/path-carver/hit-tentacle-attack";
import type { Tag } from "@/lib/team-data/types";

/** Special.Birth Ritual */
export const SPECIAL_BIRTH_RITUAL_TAG_ID = 54;

/** Attacker.Non-Active Damage.Sacrifice */
export const ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID = 50;

/** 1 Birth Ritual point → 1% of the damage pool as Sacrifice. */
export const SACRIFICE_RATE_PER_POINT = 0.01;

/** Tag ids that must be present in TeamData.tagsById for Birth Ritual → Sacrifice math. */
export const REQUIRED_BIRTH_RITUAL_TAG_IDS: readonly number[] = [
  SPECIAL_BIRTH_RITUAL_TAG_ID,
  ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID,
];

const TEAM_POOL_OWNER = "*team*";

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

/**
 * Sum finalized Active Damage family + Tentacle values across all owners.
 * Active Damage and converted Tentacle both count (no dedup). Team-wide pool
 * for aoe/single Birth Ritual.
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

/**
 * Sum ONE owner's finalized Active Damage family values (no Tentacle).
 * Per-owner pool for target_type=self Birth Ritual on that awakener.
 */
export function sumOwnerActiveDamagePool(
  ownerValues: OwnerTotals,
  owner: OwnerKey,
  tagsById: Readonly<Record<number, Tag>>,
): number {
  let pool = 0;
  const map = ownerValues.get(owner);
  if (!map) return 0;
  for (const [tagId, value] of map) {
    if (value === 0) continue;
    const tag = tagsById[tagId];
    if (!tag) continue;
    if (isActiveDamageTagName(tag.tagName)) {
      pool += value;
    }
  }
  return pool;
}

/** Sacrifice added from Birth Ritual and the damage pool. */
export function computeSacrificeAmount(
  birthRitual: number,
  damagePool: number,
): number {
  if (birthRitual <= 0 || damagePool <= 0) return 0;
  return Math.ceil(damagePool * birthRitual * SACRIFICE_RATE_PER_POINT);
}

export type BirthRitualSacrificeResult = {
  /** Uncapped aoe/single/null (+ posse/realm forced team) tag-54 total. */
  teamBirthRitual: number;
  /** owner key → that owner's target_type=self tag-54 total. */
  selfBirthRitualByOwner: Map<OwnerKey, number>;
  /** Team-wide pool (all owners' Active Damage + Tentacle) used for the team scope. */
  teamDamagePool: number;
  /** Sacrifice added across all scopes (team + self). */
  sacrificeAdded: number;
  /** Team tag-50 total after all scope writes. */
  sacrificeTotal: number;
};

export type ApplyBirthRitualSacrificeInput = {
  ownerValues: OwnerTotals;
  /**
   * target_type=self tag-54 contributions keyed by owner (awakener:N),
   * accumulated at the Layer B subject merge. Rows not in this map
   * (aoe / single / null / posse / realm) are treated as team scope.
   */
  selfByOwner: ReadonlyMap<OwnerKey, number>;
  tagsById: Readonly<Record<number, Tag>>;
};

/**
 * Hop 4e — convert uncapped Birth Ritual into Sacrifice.
 *
 * Scope follows target_type:
 * - team: aoe / single / null rows (and posse / realm, which have no single
 *   owning awakener) → all owners' Active Damage + Tentacle → written to *team*.
 * - self: each awakener's target_type=self rows → that owner's OWN Active Damage
 *   only (no Tentacle) → written to that owner's bucket (awakener:N).
 *
 * Scopes are additive (stacking): an awakener carrying self Birth Ritual keeps
 * their damage in the team pool too, so they do not miss the team-wide
 * conversion. The damage pools are never partitioned by target_type — only the
 * Birth Ritual totals are.
 *
 * Mutates ownerValues in place.
 */
export function applyBirthRitualSacrificeConversion(
  input: ApplyBirthRitualSacrificeInput,
): { result: BirthRitualSacrificeResult; steps: BirthRitualSacrificeStep[] } {
  const { ownerValues, selfByOwner, tagsById } = input;
  const steps: BirthRitualSacrificeStep[] = [];

  const sacrificeTag = tagsById[ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID];
  const additive = sacrificeTag?.isAdditive !== false;
  const isPercent = sacrificeTag?.isPercent === true;

  // Reconcile team total: merged tag-54 across all owners minus recorded self
  // rows. Anything not a recorded self row (aoe/single/null/posse/realm) lands
  // in team scope — this also keeps the split in sync with the merged total.
  const mergedTotal = sumTagAcrossOwners(
    ownerValues,
    SPECIAL_BIRTH_RITUAL_TAG_ID,
  );
  const selfBirthRitualByOwner = new Map<OwnerKey, number>();
  let selfTotal = 0;
  for (const [owner, value] of selfByOwner) {
    if (value <= 0) continue;
    selfBirthRitualByOwner.set(owner, value);
    selfTotal += value;
  }
  const teamBirthRitual = Math.max(0, mergedTotal - selfTotal);

  // Team scope — all owners' Active Damage + Tentacle → *team*.
  const teamDamagePool = sumSacrificeDamagePool(ownerValues, tagsById);
  const teamSacrifice = computeSacrificeAmount(teamBirthRitual, teamDamagePool);
  if (teamSacrifice !== 0) {
    const existing = getOwnerValue(
      ownerValues,
      TEAM_POOL_OWNER,
      ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID,
    );
    setOwnerValue(
      ownerValues,
      TEAM_POOL_OWNER,
      ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID,
      combineSameTagScalar(
        existing === 0 ? undefined : existing,
        teamSacrifice,
        additive,
        isPercent,
      ),
    );
  }

  if (teamBirthRitual > 0) {
    steps.push({
      kind: "special",
      label: BIRTH_RITUAL_SACRIFICE_LABEL,
      detail:
        `scope=team birthRitual=${teamBirthRitual} damagePool=${teamDamagePool}` +
        ` rate=1%/pt sacrifice=${teamSacrifice}`,
    });
  }

  // Self scope — per owner, only that owner's Active Damage (no Tentacle).
  let selfSacrificeTotal = 0;
  for (const [owner, birthRitual] of selfBirthRitualByOwner) {
    const pool = sumOwnerActiveDamagePool(ownerValues, owner, tagsById);
    const sacrifice = computeSacrificeAmount(birthRitual, pool);
    if (sacrifice === 0) continue;
    const existing = getOwnerValue(
      ownerValues,
      owner,
      ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID,
    );
    setOwnerValue(
      ownerValues,
      owner,
      ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID,
      combineSameTagScalar(
        existing === 0 ? undefined : existing,
        sacrifice,
        additive,
        isPercent,
      ),
    );
    selfSacrificeTotal += sacrifice;
    steps.push({
      kind: "special",
      label: BIRTH_RITUAL_SACRIFICE_LABEL,
      detail:
        `scope=self owner=${owner} birthRitual=${birthRitual} damagePool=${pool}` +
        ` rate=1%/pt sacrifice=${sacrifice}`,
    });
  }

  return {
    result: {
      teamBirthRitual,
      selfBirthRitualByOwner,
      teamDamagePool,
      sacrificeAdded: teamSacrifice + selfSacrificeTotal,
      sacrificeTotal: sumTagAcrossOwners(
        ownerValues,
        ATTACKER_NON_ACTIVE_DAMAGE_SACRIFICE_TAG_ID,
      ),
    },
    steps,
  };
}
