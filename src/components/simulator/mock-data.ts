export const POSSE_OPTIONS = [
  "Burst DPS",
  "Support Stack",
  "Tank Sustain",
  "Crit Amplify",
] as const;

export const WHEEL_OPTIONS = [
  "command card",
  "exalt",
  "tentacle",
  "rouse",
  "talent",
] as const;

export const COVENANT_OPTIONS = [
  "No Covenant",
  "Covenant I",
  "Covenant II",
  "Covenant III",
  "Covenant IV",
] as const;

export const RADAR_AXES = [
  { label: "CON", value: 72 },
  { label: "ATK", value: 85 },
  { label: "DEF", value: 60 },
  { label: "SKEY", value: 78 },
  { label: "Crit Rate", value: 45 },
  { label: "Crit DMG", value: 68 },
] as const;

export const SUMMARY_LINES = [
  "Demand fulfillment: —",
  "Synergy modifier (add_to_base_value): —",
  "Synergy modifier (compound_multiplier): —",
  "Tag branch exclusions applied: —",
  "Total weighted score: —",
] as const;

export const INITIAL_BAN_LIST = [
  "Debuff.Burn",
  "Damage.Magic",
  "Support.Heal",
] as const;

export const EMPTY_SLOT = {
  awakenerId: null,
  covenant: null,
  wheel1: null,
  wheel2: null,
} as const;

export type SlotState = {
  awakenerId: number | null;
  covenant: string | null;
  wheel1: string | null;
  wheel2: string | null;
};

export function createEmptySlots(count = 4): SlotState[] {
  return Array.from({ length: count }, () => ({
    awakenerId: null,
    covenant: null,
    wheel1: null,
    wheel2: null,
  }));
}
