import { join } from "node:path";
import type { GearAuditKind } from "./finding-schema";

export const GEAR_AUDIT_DIR_RELATIVE = "sample-data/gear-audit";

export function gearAuditDirRelative(auditKind: GearAuditKind): string {
  return `${GEAR_AUDIT_DIR_RELATIVE}/${auditKind}`;
}

/** Full-table SKeyDB export for one gear kind. */
export function skeydbFullPackRelativePath(auditKind: GearAuditKind): string {
  return `${gearAuditDirRelative(auditKind)}/full.skeydb.json`;
}

/** Full-table MotherTree export for one gear kind. */
export function mothertreeFullPackRelativePath(auditKind: GearAuditKind): string {
  return `${gearAuditDirRelative(auditKind)}/full.mothertree.json`;
}

/** Full-table deterministic audit findings for one gear kind. */
export function findingsFullRelativePath(auditKind: GearAuditKind): string {
  return `${gearAuditDirRelative(auditKind)}/full.findings.json`;
}

export function gearAuditDirAbsolute(
  repoRoot: string,
  auditKind: GearAuditKind,
): string {
  return join(repoRoot, GEAR_AUDIT_DIR_RELATIVE, auditKind);
}

export function skeydbFullPackAbsolutePath(
  repoRoot: string,
  auditKind: GearAuditKind,
): string {
  return join(repoRoot, skeydbFullPackRelativePath(auditKind));
}

export function mothertreeFullPackAbsolutePath(
  repoRoot: string,
  auditKind: GearAuditKind,
): string {
  return join(repoRoot, mothertreeFullPackRelativePath(auditKind));
}

export function findingsFullAbsolutePath(
  repoRoot: string,
  auditKind: GearAuditKind,
): string {
  return join(repoRoot, findingsFullRelativePath(auditKind));
}
