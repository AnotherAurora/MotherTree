import {
  fetchSkeydbJson,
  GEAR_AUDIT_KIND_CONFIG,
  type SkeydbCatalogFile,
  type SkeydbGearRecord,
} from "./constants";
import type { GearAuditKind } from "./finding-schema";
import { PACK_SCHEMA_VERSION, type SkeydbGearPack } from "./pack-schema";

async function fetchGearRecord(
  sha: string,
  recordsDir: string,
  id: string,
): Promise<SkeydbGearRecord | null> {
  try {
    return await fetchSkeydbJson<SkeydbGearRecord>(sha, `${recordsDir}/${id}.json`);
  } catch {
    return null;
  }
}

export async function buildSkeydbGearPack(
  auditKind: GearAuditKind,
  sha: string,
): Promise<SkeydbGearPack> {
  const config = GEAR_AUDIT_KIND_CONFIG[auditKind];
  const catalog = await fetchSkeydbJson<SkeydbCatalogFile>(sha, config.catalogPath);

  const recordsById: Record<string, SkeydbGearRecord> = {};
  const ids = catalog.records
    .map((r) => r.id)
    .filter((id) => id.startsWith(config.recordIdPrefix));

  // Fetch in batches to avoid hammering GitHub
  const batchSize = 20;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((id) => fetchGearRecord(sha, config.recordsDir, id)),
    );
    for (let j = 0; j < batch.length; j++) {
      const record = results[j];
      if (record) {
        recordsById[batch[j]!] = record;
      }
    }
  }

  return {
    schemaVersion: PACK_SCHEMA_VERSION,
    auditKind,
    skeydbCommit: sha,
    exportedAt: new Date().toISOString(),
    catalog: catalog.records,
    recordsById,
  };
}

export async function buildAllSkeydbGearPacks(
  sha: string,
  kinds: GearAuditKind[] = ["posse", "wheel", "covenant"],
): Promise<Record<GearAuditKind, SkeydbGearPack>> {
  const entries = await Promise.all(
    kinds.map(async (kind) => [kind, await buildSkeydbGearPack(kind, sha)] as const),
  );
  return Object.fromEntries(entries) as Record<GearAuditKind, SkeydbGearPack>;
}
