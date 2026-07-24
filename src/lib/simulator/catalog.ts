import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  applyManifestationReplacements,
  effectiveEnlightenment,
} from "@/lib/team-data/resolve-manifestations";
import type { AllStats, Realm } from "@/lib/team-data/types";
import type {
  CovenantGearOption,
  DesireDemandRow,
  DesireDetail,
  GearOption,
  SlotState,
  TeamComposition,
  WheelGearOption,
} from "@/lib/simulator/types";
import type { Manifestation } from "@/lib/team-data/types";
import { computeFulfillment } from "@/lib/simulator/fulfillment";

export type CatalogAwakener = {
  id: number;
  name: string;
  realm: Realm | null;
  enlightenment: number;
};

type RawManifestation = {
  tagName: string;
  valueScalar: number;
  requiredRealm: Realm | null;
  requiredRealm2: Realm | null;
  requiredAwakenerId: number | null;
  dependencyStat: AllStats | null;
};

function matchesSlotRealmRequirement(
  requiredRealm: Realm | null,
  requiredRealm2: Realm | null,
  slotRealm: Realm | null,
): boolean {
  if (requiredRealm == null && requiredRealm2 == null) return true;
  if (slotRealm == null) return true;
  return requiredRealm === slotRealm || requiredRealm2 === slotRealm;
}

export type SimulatorCatalog = {
  desire: DesireDetail;
  awakeners: CatalogAwakener[];
  posseOptions: GearOption[];
  wheelOptions: WheelGearOption[];
  covenantOptions: CovenantGearOption[];
  awakenerManifestations: Map<number, RawManifestation[]>;
  wheelManifestations: Map<number, RawManifestation[]>;
  covenantManifestations: Map<number, RawManifestation[]>;
  posseManifestations: Map<number, RawManifestation[]>;
};

async function loadTagNameMap(
  supabase: SupabaseClient<Database>,
  tagIds: number[],
): Promise<Map<number, string>> {
  if (tagIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("tag")
    .select("id, tag_name")
    .in("id", tagIds);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((t) => [t.id, t.tag_name]));
}

function toRawManifestations(
  rows: Array<{
    tag_id: number | null;
    value_scalar: number | null;
    required_realm?: Realm | null;
    required_realm1?: Realm | null;
    required_realm2?: Realm | null;
    required_awakener?: number | null;
    replaces_manifestation_id?: number | null;
    dependency_stat?: AllStats | null;
  }>,
  tagNames: Map<number, string>,
): RawManifestation[] {
  const withReplacement = applyManifestationReplacements(
    rows.map((row, index) => ({
      id: index,
      replacesManifestationId: row.replaces_manifestation_id ?? null,
      row,
    })),
  );

  return withReplacement.map(({ row }) => ({
    tagName: tagNames.get(row.tag_id ?? -1) ?? "Unknown",
    valueScalar: row.value_scalar ?? 0,
    requiredRealm: row.required_realm ?? row.required_realm1 ?? null,
    requiredRealm2: row.required_realm2 ?? null,
    requiredAwakenerId: row.required_awakener ?? null,
    dependencyStat: row.dependency_stat ?? null,
  }));
}

export async function loadSimulatorCatalog(
  supabase: SupabaseClient<Database>,
  desireId: number,
): Promise<SimulatorCatalog> {
  const [desireResult, demandsResult, anchorsResult] = await Promise.all([
    supabase
      .from("desire")
      .select("id, name, description")
      .eq("id", desireId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("desire_demand")
      .select(
        "id, tag_id, base_priority_weight, target_value, curve, decay_rate, tag:tag_id(tag_name)",
      )
      .eq("desire_id", desireId)
      .is("deleted_at", null),
    supabase
      .from("desire_anchored_awakener")
      .select("awakener_id")
      .eq("desire_id", desireId)
      .is("deleted_at", null),
  ]);

  if (desireResult.error) throw new Error(desireResult.error.message);
  if (!desireResult.data) throw new Error("Desire not found");
  if (demandsResult.error) throw new Error(demandsResult.error.message);
  if (anchorsResult.error) throw new Error(anchorsResult.error.message);

  const demands: DesireDemandRow[] = (demandsResult.data ?? []).map((row) => {
    const tag = row.tag as { tag_name: string } | null;
    return {
      id: row.id,
      tagId: row.tag_id ?? 0,
      tagName: tag?.tag_name ?? "Unknown",
      basePriorityWeight: row.base_priority_weight ?? 1,
      targetValue: row.target_value ?? 1,
      curve: row.curve,
      decayRate: row.decay_rate ?? 1,
    };
  });

  const desire: DesireDetail = {
    id: desireResult.data.id,
    name: desireResult.data.name ?? `Desire #${desireResult.data.id}`,
    description: desireResult.data.description,
    demands,
    anchoredAwakenerIds: (anchorsResult.data ?? [])
      .map((r) => r.awakener_id)
      .filter((id): id is number => id != null),
  };

  const [
    awakenerResult,
    posseResult,
    wheelResult,
    covenantResult,
    awakenerManifestResult,
    wheelManifestResult,
    covenantManifestResult,
    posseManifestResult,
  ] = await Promise.all([
    supabase
      .from("awakener")
      .select("id, name, realm, enlightenment")
      .is("deleted_at", null),
    supabase.from("posse").select("id, name").is("deleted_at", null),
    supabase
      .from("wheel")
      .select("id, name, rarity, enlightenment")
      .is("deleted_at", null),
    supabase
      .from("covenant")
      .select("id, name, team_unique")
      .is("deleted_at", null),
    supabase
      .from("awakener_tag_manifestation")
      .select(
        "awakener_id, tag_id, value_scalar, required_realm, required_enlightenment, replaces_manifestation_id",
      )
      .is("deleted_at", null),
    supabase
      .from("wheel_tag_manifestation")
      .select("wheel_id, tag_id, value_scalar, required_realm")
      .is("deleted_at", null),
    supabase
      .from("covenant_tag_manifestation")
      .select(
        "covenant_id, tag_id, value_scalar, required_realm1, required_realm2, replaces_manifestation_id",
      )
      .is("deleted_at", null),
    supabase
      .from("posse_tag_manifestation")
      .select(
        "posse_id, tag_id, value_scalar, required_realm, required_awakener, dependency_stat",
      )
      .is("deleted_at", null),
  ]);

  for (const result of [
    awakenerResult,
    posseResult,
    wheelResult,
    covenantResult,
    awakenerManifestResult,
    wheelManifestResult,
    covenantManifestResult,
    posseManifestResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const allTagIds = new Set<number>();
  for (const row of awakenerManifestResult.data ?? []) {
    if (row.tag_id != null) allTagIds.add(row.tag_id);
  }
  for (const row of wheelManifestResult.data ?? []) {
    if (row.tag_id != null) allTagIds.add(row.tag_id);
  }
  for (const row of covenantManifestResult.data ?? []) {
    if (row.tag_id != null) allTagIds.add(row.tag_id);
  }
  for (const row of posseManifestResult.data ?? []) {
    if (row.tag_id != null) allTagIds.add(row.tag_id);
  }

  const tagNames = await loadTagNameMap(supabase, [...allTagIds]);

  const awakeners: CatalogAwakener[] = (awakenerResult.data ?? []).map(
    (row) => ({
      id: row.id,
      name: row.name ?? `#${row.id}`,
      realm: row.realm,
      enlightenment: effectiveEnlightenment(row.enlightenment),
    }),
  );

  const awakenerManifestations = new Map<number, RawManifestation[]>();
  const awakenerById = new Map(awakeners.map((a) => [a.id, a]));

  for (const awakener of awakeners) {
    const rows = (awakenerManifestResult.data ?? []).filter(
      (r) =>
        r.awakener_id === awakener.id &&
        (r.required_enlightenment ?? 0) <= awakener.enlightenment,
    );
    awakenerManifestations.set(
      awakener.id,
      toRawManifestations(rows, tagNames),
    );
  }

  function groupManifestations(
    rows: Array<{
      tag_id: number | null;
      value_scalar: number | null;
      required_realm?: Realm | null;
      required_realm1?: Realm | null;
      required_realm2?: Realm | null;
      required_awakener?: number | null;
      replaces_manifestation_id?: number | null;
    }>,
    idField: string,
    entityId: number,
  ): RawManifestation[] {
    const filtered = rows.filter(
      (r) => (r as Record<string, unknown>)[idField] === entityId,
    );
    return toRawManifestations(filtered, tagNames);
  }

  const wheelManifestations = new Map<number, RawManifestation[]>();
  for (const wheel of wheelResult.data ?? []) {
    wheelManifestations.set(
      wheel.id,
      groupManifestations(
        wheelManifestResult.data ?? [],
        "wheel_id",
        wheel.id,
      ),
    );
  }

  const covenantManifestations = new Map<number, RawManifestation[]>();
  for (const covenant of covenantResult.data ?? []) {
    covenantManifestations.set(
      covenant.id,
      groupManifestations(
        covenantManifestResult.data ?? [],
        "covenant_id",
        covenant.id,
      ),
    );
  }

  const posseManifestations = new Map<number, RawManifestation[]>();
  for (const posse of posseResult.data ?? []) {
    posseManifestations.set(
      posse.id,
      groupManifestations(
        posseManifestResult.data ?? [],
        "posse_id",
        posse.id,
      ),
    );
  }

  return {
    desire,
    awakeners,
    posseOptions: (posseResult.data ?? []).map((p) => ({
      value: p.id,
      label: p.name ?? `#${p.id}`,
    })),
    wheelOptions: (wheelResult.data ?? []).map((w) => ({
      value: w.id,
      label: w.name ?? `#${w.id}`,
      rarity: w.rarity,
      enlightenment: effectiveEnlightenment(w.enlightenment),
    })),
    covenantOptions: (covenantResult.data ?? []).map((c) => ({
      value: c.id,
      label: c.name ?? `#${c.id}`,
      teamUnique: c.team_unique,
    })),
    awakenerManifestations,
    wheelManifestations,
    covenantManifestations,
    posseManifestations,
  };
}

export function buildManifestationsForComposition(
  catalog: SimulatorCatalog,
  composition: TeamComposition,
): Manifestation[] {
  const manifestations: Manifestation[] = [];
  let idCounter = 1;

  const selectedAwakenerIds = composition.slots
    .map((s) => s.awakenerId)
    .filter((id): id is number => id != null);
  const realms = [
    ...new Set(
      selectedAwakenerIds
        .map((id) => catalog.awakeners.find((a) => a.id === id)?.realm)
        .filter((r): r is Realm => r != null),
    ),
  ];

  function pushRaw(
    raw: RawManifestation,
    sourceKind: Manifestation["sourceKind"],
    slotIndex: number | null,
    awakenerId: number | null,
    sourceName: string | null = null,
  ) {
    manifestations.push({
      id: idCounter++,
      sourceKind,
      awakenerId,
      slotIndex,
      sourceName,
      tagId: 0,
      tagName: raw.tagName,
      valueScalar: raw.valueScalar,
      baseHits: null,
      dependencyStat: raw.dependencyStat,
      sourceType: null,
      targetType: null,
      buffTargetTypeRestriction: null,
      metadata: null,
      isAccumulating: false,
      requiredEnlightenment: null,
      requiredAwakenerId: raw.requiredAwakenerId,
      requiredAwakenerName: null,
      requiredRealm: raw.requiredRealm,
      requiredRealm2: raw.requiredRealm2,
      replacesManifestationId: null,
      interactionOverrides: [],
      isBaseStatTransfer: false,
    });
  }

  function gearLabel(
    options: { value: number; label: string }[],
    id: number,
  ): string {
    return options.find((o) => o.value === id)?.label ?? `#${id}`;
  }

  for (const [slotIndex, slot] of composition.slots.entries()) {
    if (slot.awakenerId != null) {
      const awakener = catalog.awakeners.find((a) => a.id === slot.awakenerId);
      const slotRealm = awakener?.realm ?? null;
      const awakenerName = awakener?.name ?? `#${slot.awakenerId}`;
      const rows = catalog.awakenerManifestations.get(slot.awakenerId) ?? [];
      for (const raw of rows) {
        if (
          !matchesSlotRealmRequirement(
            raw.requiredRealm,
            raw.requiredRealm2,
            slotRealm,
          )
        ) {
          continue;
        }
        pushRaw(raw, "awakener", slotIndex, slot.awakenerId, awakenerName);
      }

      if (slot.wheel1Id != null) {
        const wheelName = gearLabel(catalog.wheelOptions, slot.wheel1Id);
        const wheelRows =
          catalog.wheelManifestations.get(slot.wheel1Id) ?? [];
        for (const raw of wheelRows) {
          if (
            !matchesSlotRealmRequirement(
              raw.requiredRealm,
              raw.requiredRealm2,
              slotRealm,
            )
          ) {
            continue;
          }
          pushRaw(raw, "wheel", slotIndex, slot.awakenerId, wheelName);
        }
      }

      if (slot.wheel2Id != null) {
        const wheelName = gearLabel(catalog.wheelOptions, slot.wheel2Id);
        const wheelRows =
          catalog.wheelManifestations.get(slot.wheel2Id) ?? [];
        for (const raw of wheelRows) {
          if (
            !matchesSlotRealmRequirement(
              raw.requiredRealm,
              raw.requiredRealm2,
              slotRealm,
            )
          ) {
            continue;
          }
          pushRaw(raw, "wheel", slotIndex, slot.awakenerId, wheelName);
        }
      }

      if (slot.covenantId != null) {
        const covenantName = gearLabel(
          catalog.covenantOptions,
          slot.covenantId,
        );
        const covenantRows =
          catalog.covenantManifestations.get(slot.covenantId) ?? [];
        for (const raw of covenantRows) {
          if (
            !matchesSlotRealmRequirement(
              raw.requiredRealm,
              raw.requiredRealm2,
              slotRealm,
            )
          ) {
            continue;
          }
          pushRaw(
            raw,
            "covenant",
            slotIndex,
            slot.awakenerId,
            covenantName,
          );
        }
      }
    }
  }

  if (composition.posseId != null) {
    const posseName = gearLabel(catalog.posseOptions, composition.posseId);
    const posseRows =
      catalog.posseManifestations.get(composition.posseId) ?? [];
    for (const raw of posseRows) {
      if (
        raw.requiredAwakenerId != null &&
        !selectedAwakenerIds.includes(raw.requiredAwakenerId)
      ) {
        continue;
      }
      if (
        raw.requiredRealm != null &&
        realms.length > 0 &&
        !realms.includes(raw.requiredRealm)
      ) {
        continue;
      }
      pushRaw(raw, "posse", null, null, posseName);
    }
  }

  return manifestations;
}

export function scoreComposition(
  catalog: SimulatorCatalog,
  composition: TeamComposition,
): number {
  const manifestations = buildManifestationsForComposition(
    catalog,
    composition,
  );
  return computeFulfillment(manifestations, catalog.desire.demands)
    .weightedScore;
}
