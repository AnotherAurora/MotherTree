import type { DesireDemandRow, SlotState } from "@/lib/simulator/types";

export type WizardStep = "build" | "review1" | "review2";
export type PathCarverMode = "create" | "edit";

export type DraftDemandSelection = {
  tagId: number;
  tagName: string;
  targetValue: number;
};

export type EditableDemand = DesireDemandRow & { markedForDelete?: boolean };

export type AnchoredAwakenerState = {
  awakenerId: number;
  isDamageDealer: boolean;
};

export type PathCarverDesireBundle = {
  desire: {
    id: number;
    name: string;
    description: string | null;
    desireType: "general" | "specific" | null;
  };
  template: {
    id: number;
    posseId: number | null;
    slots: SlotState[];
  } | null;
  anchoredAwakeners: AnchoredAwakenerState[];
  demands: DesireDemandRow[];
};

export type SaveDemandInput = {
  id?: number;
  tagId: number;
  targetValue: number;
  basePriorityWeight: number;
  curve: "linear" | "logarithmic" | "exponential";
  decayRate: number;
};

export type SavePathCarverInput = {
  desireId?: number;
  name: string;
  description: string | null;
  slots: SlotState[];
  posseId: number;
  anchoredAwakeners: AnchoredAwakenerState[];
  demands: SaveDemandInput[];
  deletedDemandIds: number[];
};

export type ManifestedTagRow = {
  tagId: number;
  tagName: string;
  scalarSum: number;
  measurable: boolean;
};
