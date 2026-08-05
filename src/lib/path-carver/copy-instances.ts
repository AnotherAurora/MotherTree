import {
  effectiveManifestationScalar,
  type EffectiveScalarOptions,
} from "@/lib/path-carver/effective-value-scalar";
import type { Awakener, Manifestation, Tag } from "@/lib/team-data/types";

/** Layer A pool row: effectiveScalar × instance_count (no copy multiply). */
export function poolContribForManifestation(
  m: Manifestation,
  awakenersById: ReadonlyMap<number, Awakener>,
  tagsById: Readonly<Record<number, Tag>>,
  scalarOpts?: EffectiveScalarOptions,
): number {
  return (
    effectiveManifestationScalar(m, awakenersById, tagsById, scalarOpts) *
    m.instanceCount
  );
}

/**
 * Tag id → sum of poolContrib (instance-scaled, not copy-scaled).
 * Used so copy-provider bonuses do not recurse through effectiveCopies.
 */
export function buildLayerAProviderPool(
  manifestations: readonly Manifestation[],
  awakenersById: ReadonlyMap<number, Awakener>,
  tagsById: Readonly<Record<number, Tag>>,
  scalarOpts?: EffectiveScalarOptions,
): Map<number, number> {
  const pool = new Map<number, number>();
  for (const m of manifestations) {
    const contrib = poolContribForManifestation(
      m,
      awakenersById,
      tagsById,
      scalarOpts,
    );
    if (contrib === 0) continue;
    pool.set(m.tagId, (pool.get(m.tagId) ?? 0) + contrib);
  }
  return pool;
}

/** base_copies + Σ max(0, floor(pool[providerTag])). */
export function effectiveCopiesForManifestation(
  m: Manifestation,
  providerPool: ReadonlyMap<number, number>,
): number {
  let bonus = 0;
  for (const tagId of m.copyProviderTagIds) {
    bonus += Math.max(0, Math.floor(providerPool.get(tagId) ?? 0));
  }
  return m.baseCopies + bonus;
}

/** instance_count × effectiveCopies — Layer B post-multiply factor. */
export function hitCountForManifestation(
  m: Manifestation,
  providerPool: ReadonlyMap<number, number>,
): number {
  return m.instanceCount * effectiveCopiesForManifestation(m, providerPool);
}

/**
 * Composite key — source tables share independent id sequences, so numeric id
 * alone collides (e.g. ATM id 1 vs wheel/realm id 1).
 */
export function manifestationHitCountKey(m: Manifestation): string {
  return `${m.sourceKind}:${m.id}`;
}

/** Build sourceKind:id → hitCount for a Layer A applied set. */
export function buildHitCountByManifestationKey(
  manifestations: readonly Manifestation[],
  providerPool: ReadonlyMap<number, number>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of manifestations) {
    map.set(
      manifestationHitCountKey(m),
      hitCountForManifestation(m, providerPool),
    );
  }
  return map;
}

/** poolContrib × effectiveCopies (Layer A–only; identity f). */
export function layerAContribution(
  m: Manifestation,
  awakenersById: ReadonlyMap<number, Awakener>,
  tagsById: Readonly<Record<number, Tag>>,
  providerPool: ReadonlyMap<number, number>,
  scalarOpts?: EffectiveScalarOptions,
): number {
  return (
    poolContribForManifestation(m, awakenersById, tagsById, scalarOpts) *
    effectiveCopiesForManifestation(m, providerPool)
  );
}
