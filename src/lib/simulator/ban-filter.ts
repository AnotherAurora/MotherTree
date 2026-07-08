import type { BanEntry, BanEntityType } from "@/lib/simulator/types";

export function banKey(entityType: BanEntityType, entityId: number): string {
  return `${entityType}:${entityId}`;
}

export function buildBanSet(banEntries: BanEntry[]): Set<string> {
  return new Set(banEntries.map((b) => banKey(b.entityType, b.entityId)));
}

export function isEntityBanned(
  banSet: Set<string>,
  entityType: BanEntityType,
  entityId: number,
): boolean {
  return banSet.has(banKey(entityType, entityId));
}
