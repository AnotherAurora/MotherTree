export type BanEntityType = "awakener" | "posse" | "covenant" | "wheel";

export type BanEntry = {
  entityType: BanEntityType;
  entityId: number;
  label: string;
};

export type SlotState = {
  awakenerId: number | null;
  covenantId: number | null;
  covenantStatSetId: number | null;
  wheel1Id: number | null;
  wheel2Id: number | null;
};

export function createEmptySlots(count = 4): SlotState[] {
  return Array.from({ length: count }, () => ({
    awakenerId: null,
    covenantId: null,
    covenantStatSetId: null,
    wheel1Id: null,
    wheel2Id: null,
  }));
}

export type DesireSummary = {
  id: number;
  name: string;
  description: string | null;
  demandCount: number;
};

export type DesireDemandRow = {
  id: number;
  tagId: number;
  tagName: string;
  basePriorityWeight: number;
  targetValue: number;
  curve: "linear" | "exponential" | "logarithmic" | null;
  decayRate: number;
};

export type DesireDetail = {
  id: number;
  name: string;
  description: string | null;
  demands: DesireDemandRow[];
  anchoredAwakenerIds: number[];
};

export type GearOption = {
  value: number;
  label: string;
  assetName?: string;
  shortLabel?: string;
};

export type CovenantGearOption = GearOption & { teamUnique: boolean };

export type WheelGearOption = GearOption & {
  rarity: "SSR" | "SR" | "R" | "N" | null;
  enlightenment: number;
};

export type SimulatorGearOptions = {
  posse: GearOption[];
  wheel: WheelGearOption[];
  covenant: CovenantGearOption[];
  covenantStatSet: GearOption[];
};

export type TeamComposition = {
  slots: SlotState[];
  posseId: number | null;
};

export type GenerateTeamInput = {
  desireId: number;
  startAwakenerId: number;
  banEntries: BanEntry[];
};

export type RecommendInput = {
  desireId: number;
  slots: SlotState[];
  posseId: number | null;
  banEntries: BanEntry[];
};

export type GenerateTeamResult = {
  slots: SlotState[];
  posseId: number | null;
  desireName: string;
};
