import type { Database } from "@/lib/database.types";

export type AllStats = Database["public"]["Enums"]["all_stats"];
export type Layer = Database["public"]["Enums"]["layer"];
export type OperationType = Database["public"]["Enums"]["operation_type"];
/** Realm display name from `realm.name` (lookup table), not a DB enum. */
export type Realm =
  | "chaos"
  | "caro"
  | "propagation caro"
  | "aequor"
  | "benthos aequor"
  | "ultra"
  | "singularity ultra"
  | "primordia chaos";

/** Realm row used for team replace / family resolution. */
export type RealmLookupRow = {
  id: number;
  name: string;
  replace: number | null;
};
export type SourceType = Database["public"]["Enums"]["source_type"];
export type TargetType = Database["public"]["Enums"]["target_type"];
export type RealmMatchMode = Database["public"]["Enums"]["realm_match_mode"];
export type PureBonusTarget = Database["public"]["Enums"]["pure_bonus_target"];
export type ManifestationSourceKind =
  | "awakener"
  | "wheel"
  | "covenant"
  | "posse"
  | "realm";

export type TeamDataSlotInput = {
  awakenerId: number | null;
  covenantId: number | null;
  covenantStatSetId: number | null;
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
  /** Display name from `realm.name`. */
  realm: Realm | null;
  /** FK to `realm.id`. */
  realmId: number | null;
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

export type AwakenerLocalInteractionMode =
  Database["public"]["Enums"]["awakener_local_interaction_mode"];

/** Per-ATM local interaction row (table `awakener_local_manifestation_interaction`). */
export type AwakenerLocalManifestationInteraction = {
  id: number;
  mode: AwakenerLocalInteractionMode;
  modifierTagId: number | null;
  modifierTagName: string;
  targetTagId: number | null;
  targetTagName: string | null;
  layer: Layer | null;
  mathOperation: OperationType | null;
  valueScalar: number | null;
  targetType: TargetType;
  dependencyStat: AllStats | null;
  isDisabled: boolean;
};

/** @deprecated Use AwakenerLocalManifestationInteraction */
export type InteractionOverride = AwakenerLocalManifestationInteraction;

export type Manifestation = {
  id: number;
  sourceKind: ManifestationSourceKind;
  awakenerId: number | null;
  slotIndex: number | null;
  /** Parent entity display name: awakener / covenant / wheel / posse.name */
  sourceName: string | null;
  tagId: number;
  tagName: string;
  /** FK to tag.id — When.* condition; null = no trigger gate. */
  triggerCondition: number | null;
  valueScalar: number | null;
  /** How many times one copy of this effect fires. ATM: NOT NULL DEFAULT 1. */
  instanceCount: number;
  /** Starting copies before copy-provider bonuses. ATM: NOT NULL DEFAULT 1. */
  baseCopies: number;
  /** FK to copy_provider_group; null = no provider bonus. */
  copyProviderGroupId: number | null;
  copyProviderGroupName: string | null;
  /** Resolved member tag ids for copyProviderGroupId (empty if null). */
  copyProviderTagIds: number[];
  dependencyStat: AllStats | null;
  sourceType: SourceType | null;
  targetType: TargetType | null;
  buffTargetTypeRestriction: SourceType | null;
  metadata: string | null;
  isAccumulating: boolean;
  requiredEnlightenment: number | null;
  requiredAwakenerId: number | null;
  requiredAwakenerName: string | null;
  /** Display name from `realm.name`. */
  requiredRealm: Realm | null;
  requiredRealm2: Realm | null;
  /** FK to `realm.id`. */
  requiredRealmId: number | null;
  requiredRealmId2: number | null;
  replacesManifestationId: number | null;
  interactionOverrides: AwakenerLocalManifestationInteraction[];
  /**
   * Synthetic row from awakener total base stats (gear + DR + Special.Increase).
   * Acts as a modifier in interactions but is immune as an interaction subject/target.
   */
  isBaseStatTransfer: boolean;
  /**
   * Synthetic row materialized by a creates_base interaction (Phase 1).
   * Support created bases are immune as subjects; Attacker/Defender created bases are normal subjects.
   */
  isCreatedBase: boolean;
  /** Owning realm for `sourceKind === "realm"`; null otherwise. */
  realmId: number | null;
  /** RTM match mode; null for non-realm rows. */
  requiredRealmMode: RealmMatchMode | null;
  /** Realm-only rate companion for HP/RM conversion. */
  dependencyRate: number | null;
  dependencyRateStat: AllStats | null;
  /** Realm-only pure-team double target. */
  pureBonusTarget: PureBonusTarget | null;
};

/** Default RTM-only fields for non-realm manifestation constructors. */
export const NON_REALM_MANIFESTATION_FIELDS = {
  realmId: null,
  requiredRealmMode: null,
  dependencyRate: null,
  dependencyRateStat: null,
  pureBonusTarget: null,
} as const satisfies Pick<
  Manifestation,
  | "realmId"
  | "requiredRealmMode"
  | "dependencyRate"
  | "dependencyRateStat"
  | "pureBonusTarget"
>;

/** Default instance/copy fields for non-ATM / synthetic manifestations. */
export const DEFAULT_COPY_INSTANCE_FIELDS = {
  instanceCount: 1,
  baseCopies: 1,
  copyProviderGroupId: null,
  copyProviderGroupName: null,
  copyProviderTagIds: [] as number[],
} as const satisfies Pick<
  Manifestation,
  | "instanceCount"
  | "baseCopies"
  | "copyProviderGroupId"
  | "copyProviderGroupName"
  | "copyProviderTagIds"
>;

/** Equipped wheel/covenant flat stat bonus for total base-stat calculation. */
export type GearStatContribution = {
  awakenerId: number;
  sourceKind: "wheel" | "covenant" | "covenant_stat_set";
  entityId: number;
  stat: AllStats | null;
  statAmount: number | null;
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
   * When true, modifier materializes target as a synthetic base (Phase 1).
   * Intended with amplifiesSubject=false (e.g. Fiamma → Final Damage, Generate → Tentacle).
   */
  createsBase: boolean;
  /**
   * When true, apply once per matching subject base (Phase 2).
   * Intended with createsBase=false (e.g. STR Up → each Active Damage).
   */
  amplifiesSubject: boolean;
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
  realmManifestationCount: number;
};

export type TeamData = {
  awakeners: Awakener[];
  manifestations: Manifestation[];
  defaultInteractions: DefaultInteraction[];
  tagsById: Record<number, Tag>;
  /** All realm rows (id / name / replace) for team realm resolution. */
  realms: RealmLookupRow[];
  /** Per-slot wheel/covenant stat + stat_amount for total base stats. */
  gearStatContributions: GearStatContribution[];
  summary: TeamDataSummary;
};

export function createEmptyTeamData(): TeamData {
  return {
    awakeners: [],
    manifestations: [],
    defaultInteractions: [],
    tagsById: {},
    realms: [],
    gearStatContributions: [],
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
      realmManifestationCount: 0,
    },
  };
}
