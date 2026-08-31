import { z } from "zod";

/** Which gear manifestation table this audit targets. */
export const gearAuditKind = z.enum(["posse", "wheel", "covenant"]);
export type GearAuditKind = z.infer<typeof gearAuditKind>;

/** How confident the auditor is that something is wrong. */
export const findingSeverity = z.enum([
  /** Provable mismatch or broken invariant (counts, FK, numeric equality). */
  "definite",
  /** Likely wrong from heuristics; human should confirm. */
  "suspicious",
  /** Ambiguous kit wording or incomplete SKeyDB slice; no auto-fix. */
  "needs_review",
]);
export type FindingSeverity = z.infer<typeof findingSeverity>;

/** Shared categories across all three gear tables. */
export const sharedFindingCategory = z.enum([
  "missing_in_db",
  "missing_in_skeydb",
  "parent_stat_mismatch",
  "scalar_mismatch",
  "tag_mismatch",
  "target_type_mismatch",
  "buff_restriction_mismatch",
  "is_accumulating_mismatch",
  "is_permanent_mismatch",
  "metadata_mismatch",
  "orphan_parent",
  "duplicate_row",
  "structural_error",
  "needs_review",
]);

export const posseFindingCategory = sharedFindingCategory.or(
  z.enum([
    "group_key_mismatch",
    "required_awakener_mismatch",
    "required_realm_mismatch",
    /** Posse scales only team_max_hp — other non-null dependency_stat is usually a mistake. */
    "dependency_stat_unexpected",
  ]),
);

export const wheelFindingCategory = sharedFindingCategory.or(
  z.enum([
    "trigger_condition_mismatch",
    "required_realm_mismatch",
    "enlightenment_mismatch",
    "rarity_mismatch",
    /** Fractional non-percent tag without dependency_stat (kit N/100 encoding). */
    "dependency_stat_missing",
  ]),
);

export const covenantFindingCategory = sharedFindingCategory.or(
  z.enum([
    "trigger_condition_mismatch",
    "required_realm_mismatch",
    "replacement_chain_error",
    "replaces_manifestation_mismatch",
    "dependency_stat_missing",
  ]),
);

const findingBaseSchema = z.object({
  /** Stable slug, e.g. `wheel:wheel-0001:parent:rarity`. */
  id: z.string().min(1),
  severity: findingSeverity,
  /** Parent gear name (for filtering merged reports). */
  parentName: z.string().min(1),
  /** MotherTree manifestation row id when the finding targets one row. */
  manifestationId: z.number().int().positive().optional(),
  /** SKeyDB record id or path when applicable. */
  skeydbRef: z.string().min(1).optional(),
  /** Primary DB column or logical field, e.g. `value_scalar`, `group_key`. */
  field: z.string().min(1).optional(),
  expected: z.unknown().optional(),
  actual: z.unknown().optional(),
  message: z.string().min(1),
  rationale: z.string().min(1).optional(),
  suggestedFix: z.string().min(1).optional(),
});

export const posseFindingSchema = findingBaseSchema.extend({
  category: posseFindingCategory,
});

export const wheelFindingSchema = findingBaseSchema.extend({
  category: wheelFindingCategory,
});

export const covenantFindingSchema = findingBaseSchema.extend({
  category: covenantFindingCategory,
});

const auditStatsSchema = z.object({
  skeydbParentCount: z.number().int().nonnegative(),
  mothertreeParentCount: z.number().int().nonnegative(),
  mothertreeAliveParentCount: z.number().int().nonnegative(),
  manifestationCount: z.number().int().nonnegative(),
  matchedParents: z.number().int().nonnegative(),
  missingInDb: z.number().int().nonnegative(),
  missingInSkeydb: z.number().int().nonnegative(),
});

const summarySchema = z.object({
  definite: z.number().int().nonnegative(),
  suspicious: z.number().int().nonnegative(),
  needsReview: z.number().int().nonnegative(),
});

const fullTableReportBase = z.object({
  schemaVersion: z.literal(1),
  scope: z.literal("full_table"),
  skeydbCommit: z.string().min(1),
  auditedAt: z.string().datetime(),
  stats: auditStatsSchema,
  summary: summarySchema,
});

export const gearAuditFullReportSchema = z.discriminatedUnion("auditKind", [
  fullTableReportBase.extend({
    auditKind: z.literal("posse"),
    findings: z.array(posseFindingSchema),
  }),
  fullTableReportBase.extend({
    auditKind: z.literal("wheel"),
    findings: z.array(wheelFindingSchema),
  }),
  fullTableReportBase.extend({
    auditKind: z.literal("covenant"),
    findings: z.array(covenantFindingSchema),
  }),
]);

export type PosseFinding = z.infer<typeof posseFindingSchema>;
export type WheelFinding = z.infer<typeof wheelFindingSchema>;
export type CovenantFinding = z.infer<typeof covenantFindingSchema>;
export type GearAuditFullReport = z.infer<typeof gearAuditFullReportSchema>;

export function summarizeFindings(
  findings: Array<{ severity: FindingSeverity }>,
): { definite: number; suspicious: number; needsReview: number } {
  return findings.reduce(
    (acc, finding) => {
      if (finding.severity === "definite") acc.definite += 1;
      else if (finding.severity === "suspicious") acc.suspicious += 1;
      else acc.needsReview += 1;
      return acc;
    },
    { definite: 0, suspicious: 0, needsReview: 0 },
  );
}
