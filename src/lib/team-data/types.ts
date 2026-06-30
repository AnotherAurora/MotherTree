import type { Database } from "@/lib/database.types";

export type AwakenerStat = Database["public"]["Enums"]["awakener_stat"];
export type OperationType = Database["public"]["Enums"]["operation_type"];
export type Realm = Database["public"]["Enums"]["realm"];
export type SourceType = Database["public"]["Enums"]["source_type"];
export type TargetType = Database["public"]["Enums"]["target_type"];

export type TeamDataSlotInput = {
  awakenerId: number | null;
  wheel1: string | null;
  wheel2: string | null;
};

export type TeamDataInput = {
  slots: TeamDataSlotInput[];
};

export type Tag = {
  id: number;
  tagName: string;
};

export type Awakener = {
  id: number;
  name: string | null;
  realm: Realm | null;
  con: number | null;
  atk: number | null;
  def: number | null;
  skey: number | null;
  damageAmp: number | null;
  critRate: number | null;
  critDmg: number | null;
  realmMastery: number | null;
  aliemusRegen: number | null;
  sigilYield: number | null;
  deathResist: number | null;
  enlightenment: number | null;
};

export type InteractionOverride = {
  id: number;
  modifierTagId: number | null;
  modifierTagName: string;
  mathOperation: OperationType | null;
  overrideDefaultFactor: number | null;
  targetType: TargetType | null;
  dependencyStat: AwakenerStat | null;
  isDisabled: boolean;
};

export type Manifestation = {
  id: number;
  awakenerId: number;
  tagId: number;
  tagName: string;
  valueScalar: number | null;
  baseHits: number | null;
  dependencyStat: AwakenerStat | null;
  sourceType: SourceType | null;
  targetType: TargetType | null;
  rampTurns: number | null;
  requiredEnlightenment: number | null;
  requiredRealm: Realm | null;
  replacesManifestationId: number | null;
  interactionOverrides: InteractionOverride[];
};

export type DefaultInteraction = {
  id: number;
  modifierTagId: number | null;
  modifierTagName: string;
  targetTagId: number | null;
  targetTagName: string;
  exclusionTagId: number | null;
  exclusionTagName: string | null;
  mathOperation: OperationType;
  defaultFactor: number | null;
  sourceType: SourceType | null;
};

export type TeamDataSummary = {
  awakenerCount: number;
  manifestationCount: number;
  overrideCount: number;
  defaultInteractionCount: number;
  tagCount: number;
};

export type TeamData = {
  awakeners: Awakener[];
  manifestations: Manifestation[];
  defaultInteractions: DefaultInteraction[];
  tagsById: Record<number, Tag>;
  summary: TeamDataSummary;
};

export function createEmptyTeamData(): TeamData {
  return {
    awakeners: [],
    manifestations: [],
    defaultInteractions: [],
    tagsById: {},
    summary: {
      awakenerCount: 0,
      manifestationCount: 0,
      overrideCount: 0,
      defaultInteractionCount: 0,
      tagCount: 0,
    },
  };
}
