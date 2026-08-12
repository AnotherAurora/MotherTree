export const COVENANT_STATS = [
  "crit_rate",
  "crit_damage",
  "keyflare",
  "damage_amp",
  "sigil_yield",
  "death_resist",
  "aliemus_regen",
  "realm_mastery",
] as const;

export type CovenantStatId = (typeof COVENANT_STATS)[number];

export const COVENANT_STAT_LABELS: Record<CovenantStatId, string> = {
  crit_rate: "Crit Rate",
  crit_damage: "Crit Damage",
  keyflare: "Keyflare",
  damage_amp: "Damage AMP",
  sigil_yield: "Sigil Yield",
  death_resist: "Death Resist",
  aliemus_regen: "Aliemus Regen",
  realm_mastery: "Realm Mastery",
};

export type CovenantStatUnit = "percent" | "flat";

export const COVENANT_STAT_UNITS: Record<CovenantStatId, CovenantStatUnit> = {
  crit_rate: "percent",
  crit_damage: "percent",
  keyflare: "flat",
  damage_amp: "percent",
  sigil_yield: "percent",
  death_resist: "percent",
  aliemus_regen: "flat",
  realm_mastery: "flat",
};

export const MAIN_STAT_VALUES: Record<CovenantStatId, number> = {
  crit_rate: 4,
  crit_damage: 6,
  keyflare: 6,
  damage_amp: 4,
  sigil_yield: 3,
  death_resist: 17,
  aliemus_regen: 2,
  realm_mastery: 10,
};

export const SUB_STAT_VALUES_PER_LEVEL: Record<CovenantStatId, number> = {
  crit_rate: 0.2,
  crit_damage: 0.3,
  keyflare: 0.3,
  damage_amp: 0.2,
  sigil_yield: 0.15,
  death_resist: 0.7,
  aliemus_regen: 0.1,
  realm_mastery: 0.5,
};

export const COVENANT_SLOT_LABELS = ["I", "II", "III", "IV", "V", "VI"] as const;

export type CovenantSlotIndex = 0 | 1 | 2 | 3 | 4 | 5;

export const MAIN_STAT_OPTIONS_BY_SLOT: readonly (readonly CovenantStatId[])[] =
  [
    ["crit_damage", "crit_rate", "aliemus_regen", "keyflare"],
    ["crit_damage", "crit_rate", "realm_mastery", "sigil_yield"],
    ["crit_damage", "crit_rate", "damage_amp", "death_resist"],
    ["aliemus_regen", "realm_mastery", "keyflare", "sigil_yield"],
    ["aliemus_regen", "damage_amp", "keyflare", "death_resist"],
    ["realm_mastery", "damage_amp", "sigil_yield", "death_resist"],
  ] as const;

export const SUB_STAT_LEVEL_MIN = 1;
export const SUB_STAT_LEVEL_MAX = 8;

export function isCovenantStatId(value: string): value is CovenantStatId {
  return (COVENANT_STATS as readonly string[]).includes(value);
}

export function isMainStatAllowedForSlot(
  slotIndex: number,
  stat: CovenantStatId,
): boolean {
  const options = MAIN_STAT_OPTIONS_BY_SLOT[slotIndex];
  return options !== undefined && options.includes(stat);
}

export function mainContribution(
  stat: CovenantStatId | null,
  bonded: boolean,
): number {
  if (stat == null) return 0;
  const base = MAIN_STAT_VALUES[stat];
  return bonded ? base * 1.5 : base;
}

export function subContribution(
  stat: CovenantStatId | null,
  level: number,
): number {
  if (stat == null) return 0;
  if (
    !Number.isInteger(level) ||
    level < SUB_STAT_LEVEL_MIN ||
    level > SUB_STAT_LEVEL_MAX
  ) {
    return 0;
  }
  return SUB_STAT_VALUES_PER_LEVEL[stat] * level;
}

/** Round to avoid binary float noise (e.g. 0.15 * 3). */
export function roundCovenantValue(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function formatCovenantStatValue(
  stat: CovenantStatId,
  value: number,
): string {
  const rounded = roundCovenantValue(value);
  const text =
    Number.isInteger(rounded) || Math.abs(rounded - Math.round(rounded)) < 1e-9
      ? String(Math.round(rounded))
      : String(rounded);
  return COVENANT_STAT_UNITS[stat] === "percent" ? `${text}%` : text;
}

export type CovenantContribution = {
  stat: CovenantStatId;
  total: number;
};

export type CovenantPieceInput = {
  mainStat: CovenantStatId | null;
  bonded: boolean;
  subs: readonly {
    subStat: CovenantStatId | null;
    level: number;
  }[];
};

export function sumContributions(
  pieces: readonly CovenantPieceInput[],
): CovenantContribution[] {
  const totals = new Map<CovenantStatId, number>();
  for (const stat of COVENANT_STATS) {
    totals.set(stat, 0);
  }

  for (const piece of pieces) {
    if (piece.mainStat != null) {
      const prev = totals.get(piece.mainStat) ?? 0;
      totals.set(
        piece.mainStat,
        prev + mainContribution(piece.mainStat, piece.bonded),
      );
    }
    for (const sub of piece.subs) {
      if (sub.subStat == null) continue;
      const prev = totals.get(sub.subStat) ?? 0;
      totals.set(sub.subStat, prev + subContribution(sub.subStat, sub.level));
    }
  }

  return COVENANT_STATS.map((stat) => ({
    stat,
    total: roundCovenantValue(totals.get(stat) ?? 0),
  })).filter((entry) => entry.total !== 0);
}
