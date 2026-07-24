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
  /** Fractional bonus tags where 0 means no bonus (affects multiply_one_plus / multiply). */
  isPercent: boolean;
  /**
   * When true (default), post-pass same-tag results are summed.
   * When false, they are multiplied (percent: product of (1+v) − 1).
   */
  isAdditive: boolean;
};

export type Awakener = {
  id: number;
  name: string | null;
  realm: Realm | null;
  con: number | null;
  atk: number | null;
  def: number | null;
  keyflareRegen: number | null;
  damageAmp: number | null;
  critRate: number | null;
  critDmg: number | null;
  realmMastery: number | null;
  baseAliemus: number | null;
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
  valueScalar: number | null;
  targetType: TargetType | null;
  dependencyStat: AllStats | null;
  isDisabled: boolean;
};

export type Manifestation = {
  id: number;
  sourceKind: ManifestationSourceKind;
  awakenerId: number | null;
  slotIndex: number | null;
  /** Parent entity display name: awakener / covenant / wheel / posse.name */
  sourceName: string | null;
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
  requiredAwakenerId: number | null;
  requiredAwakenerName: string | null;
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
  buffTargetTypeRestriction: SourceType | null;
  /**
   * When true, modifier may synthesize target from 0 (e.g. Fiamma → Final Damage).
   * When false, target must be Layer A base-present. Ignored for Attacker/Defender sinks.
   */
  substitute: boolean;
  /**
   * When true, apply once per matching subject base.
   * When false, team-once flat (e.g. Embryo Fusion → Aliemu once, then sum with other Aliemu).
   */
  oncePerBase: boolean;
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
