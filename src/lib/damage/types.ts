import type { Database } from "@/lib/database.types";

export type AwakenerStat = Database["public"]["Enums"]["awakener_stat"];
export type OperationType = Database["public"]["Enums"]["operation_type"];
export type Realm = Database["public"]["Enums"]["realm"];
export type SourceType = Database["public"]["Enums"]["source_type"];
export type TargetType = Database["public"]["Enums"]["target_type"];

export type DamageContextSlotInput = {
  awakenerId: number | null;
  wheel1: string | null;
  wheel2: string | null;
};

export type DamageContextInput = {
  slots: DamageContextSlotInput[];
};

export type DamageTag = {
  id: number;
  tagName: string;
};

export type DamageAwakener = {
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
};

export type DamageManifestation = {
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
  requiredE: number | null;
  requiredRealm: Realm | null;
  replacesManifestationId: number | null;
};

export type DamageInteractionOverride = {
  id: number;
  manifestationId: number | null;
  modifierTagId: number | null;
  modifierTagName: string;
  mathOperation: OperationType | null;
  overrideDefaultFactor: number | null;
  targetType: TargetType | null;
  dependencyStat: AwakenerStat | null;
  isDisabled: boolean;
};

export type DamageDefaultInteraction = {
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

export type DamageContextSummary = {
  awakenerCount: number;
  manifestationCount: number;
  overrideCount: number;
  defaultInteractionCount: number;
  tagCount: number;
};

export type DamageContext = {
  awakeners: DamageAwakener[];
  manifestations: DamageManifestation[];
  overrides: DamageInteractionOverride[];
  defaultInteractions: DamageDefaultInteraction[];
  tagsById: Record<number, DamageTag>;
  summary: DamageContextSummary;
};

export function createEmptyDamageContext(): DamageContext {
  return {
    awakeners: [],
    manifestations: [],
    overrides: [],
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
