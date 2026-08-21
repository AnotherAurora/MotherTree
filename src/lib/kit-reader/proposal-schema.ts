import { z } from "zod";

const allStats = z.enum([
  "con",
  "atk",
  "def",
  "keyflare_regen",
  "damage_amp",
  "crit_rate",
  "crit_dmg",
  "realm_mastery",
  "aliemus_regen",
  "sigil_yield",
  "death_resist",
  "team_max_hp",
  "enemy_max_hp",
  "base_aliemus",
]);

const sourceType = z.enum([
  "command card",
  "exalt",
  "rouse",
  "talent",
]);

const targetType = z.enum(["self", "single", "aoe"]);
const layer = z.enum(["pre_add", "add", "post_add"]);
const mathOperation = z.enum([
  "presence_multiply",
  "add_scaled",
  "multiply_one_plus",
  "multiply",
]);
const localMode = z.enum(["unique_scaling", "aftereffect"]);
const proposalStatus = z.enum(["ok", "needs_review", "unsupported"]);

export const kitLocalProposalSchema = z
  .object({
    mode: localMode,
    modifierTagName: z.string().min(1).nullable(),
    targetTagName: z.string().min(1).nullable(),
    dependencyStat: allStats.nullable(),
    mathOperation: mathOperation,
    valueScalar: z.number(),
    targetType: targetType.default("self"),
    layer: layer.nullable(),
    isDisabled: z.boolean().default(false),
  })
  .superRefine((row, ctx) => {
    if (row.mode === "unique_scaling") {
      if (row.targetTagName != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "unique_scaling: targetTagName must be null",
          path: ["targetTagName"],
        });
      }
      if (row.modifierTagName == null && row.dependencyStat == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "unique_scaling: need modifierTagName or dependencyStat",
          path: ["dependencyStat"],
        });
      }
    }
    if (row.mode === "aftereffect") {
      if (row.targetTagName == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "aftereffect: targetTagName required",
          path: ["targetTagName"],
        });
      }
      if (row.modifierTagName != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "aftereffect: modifierTagName must be null",
          path: ["modifierTagName"],
        });
      }
      if (
        row.mathOperation !== "multiply" &&
        row.mathOperation !== "add_scaled"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "aftereffect: only multiply | add_scaled",
          path: ["mathOperation"],
        });
      }
    }
  });

export const kitAtmProposalSchema = z.object({
  clientKey: z.string().min(1),
  status: proposalStatus,
  rationale: z.string().optional(),
  unsupportedReason: z.string().optional(),
  sourceKitId: z.string().min(1),
  sourceQuote: z.string().min(1),
  sourceLayer: z
    .enum(["base", "enlighten", "talent", "soulforge_kit"])
    .optional(),
  tagName: z.string().min(1),
  valueScalar: z.number().nullable(),
  dependencyStat: allStats.nullable().default(null),
  instanceCount: z.number().int().default(1),
  baseCopies: z.number().int().default(1),
  copyProviderGroupName: z.string().min(1).nullable().default(null),
  requiredEnlightenment: z.number().int().default(0),
  requiredRealmName: z.string().min(1).nullable().default(null),
  sourceType: sourceType.nullable(),
  targetType: targetType.nullable().default("aoe"),
  triggerConditionTagName: z.string().min(1).nullable().default(null),
  isAccumulating: z.boolean().default(false),
  isPermanent: z.boolean().default(false),
  buffTargetTypeRestriction: sourceType.nullable().default(null),
  /** Documentation-only for proposals; insert CLI computes metadata via resolveInsertMetadata. */
  metadata: z.string().nullable().default(null),
  /** Override pack lookup when testing; otherwise resolved from kit pack sourceKitId. */
  sourceLabel: z.string().min(1).optional(),
  /** Full custom metadata label; wins over buildAtmMetadata (e.g. "OE Heal *3"). */
  metadataOverride: z.string().min(1).nullable().default(null),
  /** Appended to CLI-built canonical metadata (e.g. "+ SF", "*3"). */
  metadataSuffix: z.string().min(1).nullable().default(null),
  replacesClientKey: z.string().min(1).nullable().default(null),
  locals: z.array(kitLocalProposalSchema).default([]),
});

export const kitProposalFileSchema = z.object({
  schemaVersion: z.literal(1),
  skeydbCommit: z.string().min(1),
  awakenerName: z.string().min(1),
  awakenerId: z.number().int().positive().optional(),
  kitPackPath: z.string().min(1),
  proposals: z.array(kitAtmProposalSchema),
});

export type KitLocalProposal = z.infer<typeof kitLocalProposalSchema>;
export type KitAtmProposal = z.infer<typeof kitAtmProposalSchema>;
export type KitProposalFile = z.infer<typeof kitProposalFileSchema>;
