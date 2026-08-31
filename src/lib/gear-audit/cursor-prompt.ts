import { SKEYDB_COMMIT } from "@/lib/assets/skeydb-base";
import type { GearAuditKind } from "./finding-schema";
import {
  findingsFullRelativePath,
  mothertreeFullPackRelativePath,
  skeydbFullPackRelativePath,
} from "./paths";

export type GearAuditPromptInput = {
  auditKind: GearAuditKind;
  skeydbCommit?: string;
};

const AUDIT_KIND_LABEL: Record<GearAuditKind, string> = {
  posse: "Posse",
  wheel: "Wheel",
  covenant: "Covenant",
};

const TABLE_BY_KIND: Record<GearAuditKind, string> = {
  posse: "posse_tag_manifestation",
  wheel: "wheel_tag_manifestation",
  covenant: "covenant_tag_manifestation",
};

function sharedPromptTail(input: GearAuditPromptInput): string {
  const commit = input.skeydbCommit ?? SKEYDB_COMMIT;
  const skeydbPath = skeydbFullPackRelativePath(input.auditKind);
  const mothertreePath = mothertreeFullPackRelativePath(input.auditKind);
  const findingsPath = findingsFullRelativePath(input.auditKind);
  const table = TABLE_BY_KIND[input.auditKind];

  return `Use the MotherTree Gear Audit skill.
Scope: full_table
Audit kind: ${input.auditKind}
Manifestation table: ${table}
SKeyDB pack: ${skeydbPath}
MotherTree pack: ${mothertreePath}
Prior deterministic findings: ${findingsPath}
SKeyDB commit: ${commit}

Prerequisite: npm run gear:export && npm run gear:audit (deterministic pass already ran).

Rules:
- Read ONLY ${skeydbPath}, ${mothertreePath}, ${findingsPath}, and required skill documentation.
- Do NOT modify the database or write ad-hoc patch scripts.
- Do NOT re-emit findings already marked definite/suspicious in ${findingsPath}.
- Focus on semantic review: flavor text → tag mapping, trigger/realm gates, scalar encoding from descriptionArgs.
- Append NEW findings (needs_review or newly discovered definite/suspicious with rationale) to ${findingsPath} or write ${findingsPath.replace(".findings.json", ".agent-findings.json")} if merging is awkward.
- Report ONLY: count of new findings by severity + top blockers. Do NOT dump full row lists.`;
}

/** Optional agent pass after deterministic audit — posse full table. */
export function buildPosseGearAuditPrompt(input: GearAuditPromptInput): string {
  return `${AUDIT_KIND_LABEL.posse} — Gear Audit (full table): semantic review after deterministic pass.

${sharedPromptTail({ ...input, auditKind: "posse" })}

Posse-specific semantic checks:
1. Parse SKeyDB descriptionTemplate into expected tags + group_key tiers.
2. Flag required_awakener / required_realm mismatches not caught by script.
3. Confirm zero-row / count mismatches are true gaps vs modeling choice.
4. Posse dependency_stat: only team_max_hp is valid scaling; other stats are ignored at runtime.`;
}

/** Optional agent pass after deterministic audit — wheel full table. */
export function buildWheelGearAuditPrompt(input: GearAuditPromptInput): string {
  return `${AUDIT_KIND_LABEL.wheel} — Gear Audit (full table): semantic review after deterministic pass.

${sharedPromptTail({ ...input, auditKind: "wheel" })}

Wheel-specific semantic checks:
1. Map scaling descriptionArgs tiers to required_realm / enlightenment graded rows.
2. Parse trigger_condition (When/Cause) from descriptionTemplate.
3. Verify dependency_stat + value_scalar against SKeyDB stat+% args.
4. Confirm parent enlightenment / stat_amount when inferable from SKeyDB.`;
}

/** Optional agent pass after deterministic audit — covenant full table. */
export function buildCovenantGearAuditPrompt(input: GearAuditPromptInput): string {
  return `${AUDIT_KIND_LABEL.covenant} — Gear Audit (full table): semantic review after deterministic pass.

${sharedPromptTail({ ...input, auditKind: "covenant" })}

Covenant-specific semantic checks:
1. Map each setEffects[] entry to manifestation rows (including replacements).
2. Validate replaces_manifestation_id upgrade semantics vs SKeyDB set tiers.
3. Parse dual-realm gates → required_realm1 / required_realm2.
4. Verify dependency_stat + value_scalar against SKeyDB args.`;
}

export function buildGearAuditPrompt(input: GearAuditPromptInput): string {
  switch (input.auditKind) {
    case "posse":
      return buildPosseGearAuditPrompt(input);
    case "wheel":
      return buildWheelGearAuditPrompt(input);
    case "covenant":
      return buildCovenantGearAuditPrompt(input);
  }
}
