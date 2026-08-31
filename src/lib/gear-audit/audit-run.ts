import type {
  GearAuditKind,
  PosseFinding,
  WheelFinding,
  CovenantFinding,
} from "./finding-schema";
import {
  countCovenantSetEffects,
  mapSkeydbMainstat,
  normalizeNameKey,
  recordHasEffectText,
} from "./constants";
import { shouldSkipParentAudit } from "./audit-exclusions";
import type {
  CovenantManifestation,
  CovenantParent,
  MothertreeGearPack,
  PosseManifestation,
  PosseParent,
  SkeydbGearPack,
  WheelManifestation,
  WheelParent,
} from "./pack-schema";
import { summarizeFindings } from "./finding-schema";

type AnyFinding = PosseFinding | WheelFinding | CovenantFinding;

const TAG_ALLOWLIST_PREFIXES = [
  "Support.Increase Gain.",
  "Support.Take Effect Again",
  "Special.Cause.",
  "When.",
] as const;

export type GearAuditStats = {
  skeydbParentCount: number;
  mothertreeParentCount: number;
  mothertreeAliveParentCount: number;
  manifestationCount: number;
  matchedParents: number;
  missingInDb: number;
  missingInSkeydb: number;
};

export type GearAuditRunResult = {
  schemaVersion: 1;
  scope: "full_table";
  auditKind: GearAuditKind;
  skeydbCommit: string;
  auditedAt: string;
  stats: GearAuditStats;
  findings: AnyFinding[];
  summary: ReturnType<typeof summarizeFindings>;
};

function isFractional(value: number): boolean {
  return Math.abs(value - Math.trunc(value)) > 1e-9;
}

function isAllowlistedTag(tagName: string): boolean {
  return TAG_ALLOWLIST_PREFIXES.some(
    (prefix) => tagName === prefix || tagName.startsWith(`${prefix}.`),
  );
}

function tagNameFor(
  pack: MothertreeGearPack,
  tagId: number | null,
): string | null {
  if (tagId == null) return null;
  return pack.tagsById[tagId]?.tag_name ?? null;
}

function isAliveParent(parent: { deleted_at: string | null }): boolean {
  return parent.deleted_at == null;
}

function isAliveManifestation(row: { deleted_at: string | null }): boolean {
  return row.deleted_at == null;
}

function makeFindingId(
  kind: GearAuditKind,
  slug: string,
  scope: string,
  field?: string,
): string {
  const parts = [kind, slug, scope];
  if (field) parts.push(field);
  return parts.join(":");
}

function addCoverageFindings(
  kind: GearAuditKind,
  skeydbPack: SkeydbGearPack,
  mtPack: MothertreeGearPack,
  findings: AnyFinding[],
): GearAuditStats {
  const skeyByName = new Map(
    skeydbPack.catalog.map((r) => [normalizeNameKey(r.name), r]),
  );
  const mtByName = new Map(
    mtPack.parents
      .filter(isAliveParent)
      .map((p) => [normalizeNameKey(p.name), p]),
  );

  let missingInDb = 0;
  let missingInSkeydb = 0;
  let matchedParents = 0;

  for (const [key, catalogRow] of skeyByName) {
    const slug = catalogRow.id;
    const mtParent = mtByName.get(key);
    const wheelRarity =
      kind === "wheel"
        ? ((mtParent as WheelParent | undefined)?.rarity ??
          catalogRow.rarity ??
          null)
        : null;

    if (shouldSkipParentAudit(kind, catalogRow.name, { rarity: wheelRarity })) {
      if (mtParent) matchedParents += 1;
      continue;
    }

    if (!mtParent) {
      missingInDb += 1;
      findings.push({
        id: makeFindingId(kind, slug, "parent", "missing-in-db"),
        severity: "definite",
        category: "missing_in_db",
        parentName: catalogRow.name,
        skeydbRef: catalogRow.id,
        field: "parent",
        expected: catalogRow.name,
        message: `SKeyDB ${kind} "${catalogRow.name}" has no matching alive MotherTree parent row.`,
        suggestedFix: `Add ${kind} parent row with name "${catalogRow.name}".`,
      } as AnyFinding);
    } else {
      matchedParents += 1;
    }
  }

  for (const [key, parent] of mtByName) {
    if (!skeyByName.has(key)) {
      missingInSkeydb += 1;
      findings.push({
        id: makeFindingId(kind, String(parent.id), "parent", "missing-in-skeydb"),
        severity: "suspicious",
        category: "missing_in_skeydb",
        parentName: parent.name,
        field: "parent",
        actual: parent.name,
        message: `MotherTree ${kind} "${parent.name}" (id=${parent.id}) not found in SKeyDB catalog.`,
        rationale:
          "May be renamed, unreleased, or intentionally ahead of SKeyDB — confirm manually.",
      } as AnyFinding);
    }
  }

  return {
    skeydbParentCount: skeyByName.size,
    mothertreeParentCount: mtPack.parents.length,
    mothertreeAliveParentCount: mtByName.size,
    manifestationCount: mtPack.manifestations.filter(isAliveManifestation).length,
    matchedParents,
    missingInDb,
    missingInSkeydb,
  };
}

function addZeroManifestationFindings(
  kind: GearAuditKind,
  skeydbPack: SkeydbGearPack,
  mtPack: MothertreeGearPack,
  parentFk: "wheel_id" | "covenant_id" | "posse_id",
  findings: AnyFinding[],
): void {
  const mtByName = new Map(
    mtPack.parents
      .filter(isAliveParent)
      .map((p) => [normalizeNameKey(p.name), p]),
  );

  for (const catalogRow of skeydbPack.catalog) {
    const key = normalizeNameKey(catalogRow.name);
    const parent = mtByName.get(key);
    if (!parent) continue;

    const wheelRarity =
      kind === "wheel" ? ((parent as WheelParent).rarity ?? catalogRow.rarity ?? null) : null;
    if (shouldSkipParentAudit(kind, catalogRow.name, { rarity: wheelRarity })) continue;

    const record = skeydbPack.recordsById[catalogRow.id];
    if (!record || !recordHasEffectText(record)) continue;

    if (kind === "covenant") {
      const setCount = countCovenantSetEffects(record);
      if (Math.max(0, setCount - 1) === 0) continue;
    }

    const rows = mtPack.manifestations.filter(
      (m) => isAliveManifestation(m) && (m as Record<string, unknown>)[parentFk] === parent.id,
    );

    if (rows.length === 0) {
      findings.push({
        id: makeFindingId(kind, catalogRow.id, "manifestations", "zero-rows"),
        severity: "suspicious",
        category: "missing_in_db",
        parentName: catalogRow.name,
        skeydbRef: catalogRow.id,
        field: "manifestations",
        expected: ">=1 manifestation row(s)",
        actual: 0,
        message: `SKeyDB "${catalogRow.name}" has effect text but MotherTree has zero alive manifestation rows.`,
        suggestedFix: "Add manifestation rows for this parent or confirm effect is modeled elsewhere.",
      } as AnyFinding);
    }
  }
}

function addWheelParentFindings(
  skeydbPack: SkeydbGearPack,
  mtPack: MothertreeGearPack,
  findings: WheelFinding[],
): void {
  const mtByName = new Map(
    (mtPack.parents as WheelParent[])
      .filter(isAliveParent)
      .map((p) => [normalizeNameKey(p.name), p]),
  );

  for (const catalogRow of skeydbPack.catalog) {
    const parent = mtByName.get(normalizeNameKey(catalogRow.name));
    if (!parent) continue;

    if (
      shouldSkipParentAudit("wheel", catalogRow.name, {
        rarity: parent.rarity ?? catalogRow.rarity ?? null,
      })
    ) {
      continue;
    }

    const record = skeydbPack.recordsById[catalogRow.id];
    const slug = catalogRow.id;

    if (record?.rarity && parent.rarity && record.rarity !== parent.rarity) {
      findings.push({
        id: makeFindingId("wheel", slug, "parent", "rarity"),
        severity: "definite",
        category: "rarity_mismatch",
        parentName: catalogRow.name,
        skeydbRef: catalogRow.id,
        field: "rarity",
        expected: record.rarity,
        actual: parent.rarity,
        message: `Wheel "${catalogRow.name}" rarity mismatch (SKeyDB vs MotherTree).`,
      });
    }

    const expectedStat = mapSkeydbMainstat(record?.mainstatKey ?? catalogRow.mainstatKey);
    if (expectedStat && parent.stat && expectedStat !== parent.stat) {
      findings.push({
        id: makeFindingId("wheel", slug, "parent", "stat"),
        severity: "definite",
        category: "parent_stat_mismatch",
        parentName: catalogRow.name,
        skeydbRef: catalogRow.id,
        field: "stat",
        expected: expectedStat,
        actual: parent.stat,
        message: `Wheel "${catalogRow.name}" main stat mismatch (SKeyDB mainstatKey vs wheel.stat).`,
      });
    }

    // Manifestation rows model distinct tag effects, not enlightenment tier count.
    // wheel.stat holds gear main stat (mainstatKey); scaling args are not 1 row per tier.
  }
}

function addCovenantSetCountFindings(
  skeydbPack: SkeydbGearPack,
  mtPack: MothertreeGearPack,
  findings: CovenantFinding[],
): void {
  const mtByName = new Map(
    (mtPack.parents as CovenantParent[])
      .filter(isAliveParent)
      .map((p) => [normalizeNameKey(p.name), p]),
  );

  for (const catalogRow of skeydbPack.catalog) {
    const parent = mtByName.get(normalizeNameKey(catalogRow.name));
    if (!parent) continue;

    const record = skeydbPack.recordsById[catalogRow.id];
    if (!record) continue;

    const setCount = countCovenantSetEffects(record);
    const rows = (mtPack.manifestations as CovenantManifestation[]).filter(
      (m) => isAliveManifestation(m) && m.covenant_id === parent.id,
    );

    // First setEffects entry is modeled on covenant.stat / stat_amount, not manifestations.
    const expectedManifestationRows = Math.max(0, setCount - 1);

    if (expectedManifestationRows > 0 && rows.length === 0) continue; // zero-manifestation check

    if (
      expectedManifestationRows > 0 &&
      rows.length > 0 &&
      rows.length < expectedManifestationRows
    ) {
      findings.push({
        id: makeFindingId("covenant", catalogRow.id, "manifestations", "set-count"),
        severity: "suspicious",
        category: "structural_error",
        parentName: catalogRow.name,
        skeydbRef: catalogRow.id,
        field: "manifestation_count",
        expected: `>=${expectedManifestationRows} row(s) (SKeyDB setEffects minus parent stat)`,
        actual: rows.length,
        message: `Covenant "${catalogRow.name}" has ${rows.length} manifestation row(s) but SKeyDB implies ${expectedManifestationRows} tag row(s) after covenant.stat.`,
        rationale:
          "First setEffects line is stored on covenant.stat/stat_amount; remaining sets map to manifestations.",
      });
    }
  }
}

function addDependencyStatMissingFindings(
  kind: "wheel" | "covenant",
  mtPack: MothertreeGearPack,
  parentFk: "wheel_id" | "covenant_id",
  findings: AnyFinding[],
): void {
  const parentNames = new Map(
    mtPack.parents.filter(isAliveParent).map((p) => [p.id, p.name]),
  );
  const wheelRarityById =
    kind === "wheel"
      ? new Map(
          (mtPack.parents as WheelParent[])
            .filter(isAliveParent)
            .map((p) => [p.id, p.rarity] as const),
        )
      : null;

  for (const row of mtPack.manifestations) {
    if (!isAliveManifestation(row)) continue;
    const parentId = (row as Record<string, unknown>)[parentFk] as number | null;
    if (parentId == null) continue;

    const parentName = parentNames.get(parentId) ?? `#${parentId}`;
    if (
      kind === "wheel" &&
      shouldSkipParentAudit("wheel", parentName, {
        rarity: wheelRarityById?.get(parentId) ?? null,
      })
    ) {
      continue;
    }

    const tagName = tagNameFor(mtPack, row.tag_id);
    const scalar = row.value_scalar;
    if (!tagName || scalar == null) continue;

    const isPercent = mtPack.tagsById[row.tag_id ?? -1]?.is_percent === true;
    if (isPercent || row.dependency_stat != null) continue;
    if (scalar <= 0 || !isFractional(scalar) || scalar >= 1) continue;
    if (isAllowlistedTag(tagName)) continue;

    findings.push({
      id: makeFindingId(kind, String(row.id), "dep-stat"),
      severity: "suspicious",
      category: "dependency_stat_missing",
      parentName,
      manifestationId: row.id,
      field: "dependency_stat",
      message: `Non-percent tag "${tagName}" with fractional value_scalar=${scalar} and null dependency_stat.`,
      rationale: "Typical N/100 kit encoding — see docs/admin/kit-reader.md.",
      suggestedFix: "Set dependency_stat to atk/def/con when SKeyDB arg uses stat+% scaling.",
    } as AnyFinding);
  }
}

function addPosseDependencyStatFindings(
  mtPack: MothertreeGearPack,
  findings: PosseFinding[],
): void {
  const parentNames = new Map(
    (mtPack.parents as PosseParent[])
      .filter(isAliveParent)
      .map((p) => [p.id, p.name]),
  );

  for (const row of mtPack.manifestations as PosseManifestation[]) {
    if (!isAliveManifestation(row) || row.dependency_stat == null) continue;
    if (row.dependency_stat === "team_max_hp") continue;
    const parentName = parentNames.get(row.posse_id ?? -1) ?? `#${row.posse_id}`;
    findings.push({
      id: makeFindingId("posse", String(row.id), "dep-stat"),
      severity: "suspicious",
      category: "dependency_stat_unexpected",
      parentName,
      manifestationId: row.id,
      field: "dependency_stat",
      actual: row.dependency_stat,
      message: `Posse row id=${row.id} sets dependency_stat=${row.dependency_stat} but posse runtime only scales team_max_hp.`,
      suggestedFix: "Clear dependency_stat or set to team_max_hp when HP-scaled.",
    });
  }
}

function addOrphanManifestationFindings(
  kind: GearAuditKind,
  mtPack: MothertreeGearPack,
  parentFk: "wheel_id" | "covenant_id" | "posse_id",
  findings: AnyFinding[],
): void {
  const aliveParentIds = new Set(
    mtPack.parents.filter(isAliveParent).map((p) => p.id),
  );
  const parentNames = new Map(mtPack.parents.map((p) => [p.id, p.name]));

  for (const row of mtPack.manifestations) {
    if (!isAliveManifestation(row)) continue;
    const parentId = (row as Record<string, unknown>)[parentFk] as number | null;
    if (parentId == null || !aliveParentIds.has(parentId)) {
      findings.push({
        id: makeFindingId(kind, String(row.id), "orphan"),
        severity: "definite",
        category: "orphan_parent",
        parentName: parentId != null ? (parentNames.get(parentId) ?? `#${parentId}`) : "null",
        manifestationId: row.id,
        field: parentFk,
        actual: parentId,
        message: `Manifestation id=${row.id} references missing or soft-deleted parent (${parentFk}=${parentId}).`,
      } as AnyFinding);
    }
  }
}

function addDuplicateFindings(
  kind: GearAuditKind,
  mtPack: MothertreeGearPack,
  keyFn: (row: MothertreeGearPack["manifestations"][number]) => string,
  findings: AnyFinding[],
): void {
  const seen = new Map<string, number[]>();

  for (const row of mtPack.manifestations) {
    if (!isAliveManifestation(row)) continue;
    const key = keyFn(row);
    const list = seen.get(key) ?? [];
    list.push(row.id);
    seen.set(key, list);
  }

  for (const [key, ids] of seen) {
    if (ids.length <= 1) continue;
    const [firstId, ...rest] = ids;
    const row = mtPack.manifestations.find((m) => m.id === firstId);
    const parentFk =
      kind === "wheel" ? "wheel_id" : kind === "covenant" ? "covenant_id" : "posse_id";
    const parentId = row
      ? ((row as Record<string, unknown>)[parentFk] as number | null)
      : null;
    const parentName =
      parentId != null
        ? (mtPack.parents.find((p) => p.id === parentId)?.name ?? `#${parentId}`)
        : "?";

    findings.push({
      id: makeFindingId(kind, key.replace(/:/g, "-"), "duplicate"),
      severity: "definite",
      category: "duplicate_row",
      parentName,
      manifestationId: firstId,
      field: "logical_key",
      actual: { key, ids: rest.concat(firstId!) },
      message: `Duplicate manifestation logical key "${key}" (${ids.length} alive rows: ${ids.join(", ")}).`,
    } as AnyFinding);
  }
}

function addCovenantChainFindings(
  mtPack: MothertreeGearPack,
  findings: CovenantFinding[],
): void {
  const aliveRows = (mtPack.manifestations as CovenantManifestation[]).filter(
    isAliveManifestation,
  );
  const byId = new Map(aliveRows.map((r) => [r.id, r]));
  const parentNames = new Map(
    (mtPack.parents as CovenantParent[]).map((p) => [p.id, p.name]),
  );

  for (const row of aliveRows) {
    const replId = row.replaces_manifestation_id;
    if (replId == null) continue;

    const parentName = parentNames.get(row.covenant_id ?? -1) ?? `#${row.covenant_id}`;
    const base = byId.get(replId);

    if (!base) {
      findings.push({
        id: makeFindingId("covenant", String(row.id), "chain", "dangling"),
        severity: "definite",
        category: "replacement_chain_error",
        parentName,
        manifestationId: row.id,
        field: "replaces_manifestation_id",
        actual: replId,
        message: `Covenant manifestation id=${row.id} replaces_manifestation_id=${replId} but target row is missing or deleted.`,
      });
      continue;
    }

    if (base.covenant_id !== row.covenant_id) {
      findings.push({
        id: makeFindingId("covenant", String(row.id), "chain", "cross-covenant"),
        severity: "definite",
        category: "replacement_chain_error",
        parentName,
        manifestationId: row.id,
        field: "replaces_manifestation_id",
        message: `Replacer id=${row.id} points to id=${replId} on a different covenant_id.`,
      });
    }

    if (base.id === row.id) {
      findings.push({
        id: makeFindingId("covenant", String(row.id), "chain", "self"),
        severity: "definite",
        category: "replacement_chain_error",
        parentName,
        manifestationId: row.id,
        field: "replaces_manifestation_id",
        message: `Covenant manifestation id=${row.id} replaces itself.`,
      });
    }
  }

  // Cycle detection (small graphs)
  for (const row of aliveRows) {
    if (row.replaces_manifestation_id == null) continue;
    const visited = new Set<number>();
    let current: CovenantManifestation | undefined = row;
    while (current?.replaces_manifestation_id != null) {
      if (visited.has(current.id)) {
        const parentName =
          parentNames.get(row.covenant_id ?? -1) ?? `#${row.covenant_id}`;
        findings.push({
          id: makeFindingId("covenant", String(row.id), "chain", "cycle"),
          severity: "definite",
          category: "replacement_chain_error",
          parentName,
          manifestationId: row.id,
          field: "replaces_manifestation_id",
          message: `Replacement chain cycle involving manifestation id=${row.id}.`,
        });
        break;
      }
      visited.add(current.id);
      current = byId.get(current.replaces_manifestation_id);
    }
  }
}

function wheelLogicalKey(
  pack: MothertreeGearPack,
  row: WheelManifestation,
): string {
  const tag = tagNameFor(pack, row.tag_id) ?? "null-tag";
  return `${row.wheel_id}:${tag}:${row.required_realm ?? "null"}:${row.trigger_condition ?? "null"}:${row.value_scalar ?? "null"}:${row.target_type ?? "null"}:${row.buff_target_type_restriction ?? "null"}`;
}

function covenantLogicalKey(
  pack: MothertreeGearPack,
  row: CovenantManifestation,
): string {
  const tag = tagNameFor(pack, row.tag_id) ?? "null-tag";
  return `${row.covenant_id}:${tag}:${row.required_realm1 ?? "null"}:${row.required_realm2 ?? "null"}:${row.trigger_condition ?? "null"}:${row.replaces_manifestation_id ?? "null"}:${row.value_scalar ?? "null"}`;
}

function posseLogicalKey(
  pack: MothertreeGearPack,
  row: PosseManifestation,
): string {
  const tag = tagNameFor(pack, row.tag_id) ?? "null-tag";
  return `${row.posse_id}:${row.group_key}:${tag}:${row.required_awakener ?? "null"}:${row.required_realm ?? "null"}:${row.value_scalar ?? "null"}`;
}

export function runGearAudit(
  skeydbPack: SkeydbGearPack,
  mtPack: MothertreeGearPack,
): GearAuditRunResult {
  if (skeydbPack.auditKind !== mtPack.auditKind) {
    throw new Error(
      `Pack auditKind mismatch: ${skeydbPack.auditKind} vs ${mtPack.auditKind}`,
    );
  }

  const kind = skeydbPack.auditKind;
  const findings: AnyFinding[] = [];

  const stats = addCoverageFindings(kind, skeydbPack, mtPack, findings);

  if (kind === "wheel") {
    addZeroManifestationFindings(kind, skeydbPack, mtPack, "wheel_id", findings);
    addWheelParentFindings(skeydbPack, mtPack, findings as WheelFinding[]);
    addOrphanManifestationFindings(kind, mtPack, "wheel_id", findings);
    addDuplicateFindings(kind, mtPack, (row) =>
      wheelLogicalKey(mtPack, row as WheelManifestation),
    findings);
    addDependencyStatMissingFindings("wheel", mtPack, "wheel_id", findings);
  } else if (kind === "covenant") {
    addZeroManifestationFindings(kind, skeydbPack, mtPack, "covenant_id", findings);
    addCovenantSetCountFindings(skeydbPack, mtPack, findings as CovenantFinding[]);
    addOrphanManifestationFindings(kind, mtPack, "covenant_id", findings);
    addDuplicateFindings(kind, mtPack, (row) =>
      covenantLogicalKey(mtPack, row as CovenantManifestation),
    findings);
    addCovenantChainFindings(mtPack, findings as CovenantFinding[]);
    addDependencyStatMissingFindings("covenant", mtPack, "covenant_id", findings);
  } else {
    addZeroManifestationFindings(kind, skeydbPack, mtPack, "posse_id", findings);
    addOrphanManifestationFindings(kind, mtPack, "posse_id", findings);
    addDuplicateFindings(kind, mtPack, (row) =>
      posseLogicalKey(mtPack, row as PosseManifestation),
    findings);
    addPosseDependencyStatFindings(mtPack, findings as PosseFinding[]);
  }

  const summary = summarizeFindings(findings);

  return {
    schemaVersion: 1,
    scope: "full_table",
    auditKind: kind,
    skeydbCommit: skeydbPack.skeydbCommit,
    auditedAt: new Date().toISOString(),
    stats,
    findings,
    summary,
  };
}

export function hasBlockingFindings(result: GearAuditRunResult): boolean {
  return result.summary.definite > 0 || result.summary.suspicious > 0;
}
