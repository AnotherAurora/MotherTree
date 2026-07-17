import type { Database } from "@/lib/database.types";

export type AllStats = Database["public"]["Enums"]["all_stats"];
export type Layer = Database["public"]["Enums"]["layer"];
export type OperationType = Database["public"]["Enums"]["operation_type"];
export type Realm = Database["public"]["Enums"]["realm"];
export type SourceType = Database["public"]["Enums"]["source_type"];
export type TargetType = Database["public"]["Enums"]["target_type"];
export type ManifestationSourceKind =
  | "awakener"
  | "wheel"
  | "covenant"
  | "posse";

export type TeamDataSlotInput = {
  awakenerId: number | null;
  covenantId: number | null;
  wheel1Id: number | null;
  wheel2Id: number | null;
};

export type TeamDataInput = {
  slots: TeamDataSlotInput[];
  posseId: number | null;
};

export type Tag = {
  id: number;
  tagName: string;
  layer: Layer | null;
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
  dependencyStat: AllStats | null;
  isDisabled: boolean;
};

export type Manifestation = {
  id: number;
  sourceKind: ManifestationSourceKind;
  awakenerId: number | null;
  slotIndex: number | null;
  tagId: number;
  tagName: string;
  valueScalar: number | null;
  baseHits: number | null;
  dependencyStat: AllStats | null;
  sourceType: SourceType | null;
  targetType: TargetType | null;
  buffTargetTypeRestriction: SourceType | null;
  metadata: string | null;
  isAccumulating: boolean;
  requiredEnlightenment: number | null;
  requiredRealm: Realm | null;
  requiredRealm2: Realm | null;
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
  posseManifestationCount: number;
  wheelManifestationCount: number;
  covenantManifestationCount: number;
  awakenerManifestationCount: number;
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
      posseManifestationCount: 0,
      wheelManifestationCount: 0,
      covenantManifestationCount: 0,
      awakenerManifestationCount: 0,
    },
  };
}
