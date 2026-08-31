import { z } from "zod";
import type { GearAuditKind } from "./finding-schema";
import {
  type SkeydbCatalogRecord,
  type SkeydbGearRecord,
} from "./constants";

export const PACK_SCHEMA_VERSION = 1 as const;

export const skeydbGearPackSchema = z.object({
  schemaVersion: z.literal(PACK_SCHEMA_VERSION),
  auditKind: z.enum(["posse", "wheel", "covenant"]),
  skeydbCommit: z.string().min(1),
  exportedAt: z.string().datetime(),
  catalog: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string().optional(),
      rarity: z.string().optional(),
      mainstatKey: z.string().optional(),
      realm: z.string().optional(),
    }),
  ),
  recordsById: z.record(z.string(), z.unknown()),
});

export type SkeydbGearPack = {
  schemaVersion: typeof PACK_SCHEMA_VERSION;
  auditKind: GearAuditKind;
  skeydbCommit: string;
  exportedAt: string;
  catalog: SkeydbCatalogRecord[];
  recordsById: Record<string, SkeydbGearRecord>;
};

const tagRefSchema = z.object({
  id: z.number(),
  tag_name: z.string().nullable(),
  is_percent: z.boolean().nullable().optional(),
});

const realmRefSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const awakenerRefSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export const mothertreeGearPackSchema = z.object({
  schemaVersion: z.literal(PACK_SCHEMA_VERSION),
  auditKind: z.enum(["posse", "wheel", "covenant"]),
  exportedAt: z.string().datetime(),
  parents: z.array(z.record(z.string(), z.unknown())),
  manifestations: z.array(z.record(z.string(), z.unknown())),
  tagsById: z.record(z.string(), tagRefSchema),
  realmsById: z.record(z.string(), realmRefSchema),
  awakenersById: z.record(z.string(), awakenerRefSchema),
});

export type TagRef = z.infer<typeof tagRefSchema>;
export type RealmRef = z.infer<typeof realmRefSchema>;
export type AwakenerRef = z.infer<typeof awakenerRefSchema>;

export type WheelParent = {
  id: number;
  name: string;
  enlightenment: number | null;
  rarity: string | null;
  stat: string | null;
  stat_amount: number | null;
  deleted_at: string | null;
};

export type CovenantParent = {
  id: number;
  name: string;
  stat: string | null;
  stat_amount: number | null;
  team_unique: boolean;
  deleted_at: string | null;
};

export type PosseParent = {
  id: number;
  name: string;
  deleted_at: string | null;
};

export type ManifestationBase = {
  id: number;
  metadata: string | null;
  value_scalar: number | null;
  dependency_stat: string | null;
  target_type: string | null;
  buff_target_type_restriction: string | null;
  is_accumulating: boolean;
  is_permanent: boolean | null;
  tag_id: number | null;
  deleted_at: string | null;
};

export type WheelManifestation = ManifestationBase & {
  wheel_id: number | null;
  required_realm: number | null;
  trigger_condition: number | null;
};

export type CovenantManifestation = ManifestationBase & {
  covenant_id: number | null;
  required_realm1: number | null;
  required_realm2: number | null;
  trigger_condition: number | null;
  replaces_manifestation_id: number | null;
};

export type PosseManifestation = ManifestationBase & {
  posse_id: number | null;
  group_key: string;
  required_awakener: number | null;
  required_realm: number | null;
};

export type MothertreeGearPack = {
  schemaVersion: typeof PACK_SCHEMA_VERSION;
  auditKind: GearAuditKind;
  exportedAt: string;
  parents: Array<WheelParent | CovenantParent | PosseParent>;
  manifestations: Array<
    WheelManifestation | CovenantManifestation | PosseManifestation
  >;
  tagsById: Record<number, TagRef>;
  realmsById: Record<number, RealmRef>;
  awakenersById: Record<number, AwakenerRef>;
};

export function parseSkeydbGearPack(raw: unknown): SkeydbGearPack {
  const parsed = skeydbGearPackSchema.parse(raw);
  return {
    ...parsed,
    recordsById: parsed.recordsById as Record<string, SkeydbGearRecord>,
  };
}

export function parseMothertreeGearPack(raw: unknown): MothertreeGearPack {
  const parsed = mothertreeGearPackSchema.parse(raw);
  return {
    schemaVersion: parsed.schemaVersion,
    auditKind: parsed.auditKind,
    exportedAt: parsed.exportedAt,
    parents: parsed.parents as MothertreeGearPack["parents"],
    manifestations: parsed.manifestations as MothertreeGearPack["manifestations"],
    tagsById: Object.fromEntries(
      Object.entries(parsed.tagsById).map(([k, v]) => [Number(k), v]),
    ),
    realmsById: Object.fromEntries(
      Object.entries(parsed.realmsById).map(([k, v]) => [Number(k), v]),
    ),
    awakenersById: Object.fromEntries(
      Object.entries(parsed.awakenersById).map(([k, v]) => [Number(k), v]),
    ),
  };
}
