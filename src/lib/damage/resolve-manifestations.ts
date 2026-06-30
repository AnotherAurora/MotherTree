export type ManifestationReplacementRow = {
  id: number;
  replacesManifestationId: number | null;
};

export function effectiveEnlightenment(value: number | null | undefined): number {
  return value ?? 0;
}

export function applyManifestationReplacements<
  T extends ManifestationReplacementRow,
>(rows: T[]): T[] {
  const replacedIds = new Set(
    rows
      .map((r) => r.replacesManifestationId)
      .filter((id): id is number => id != null),
  );
  return rows.filter((r) => !replacedIds.has(r.id));
}
