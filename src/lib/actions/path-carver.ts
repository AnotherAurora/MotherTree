"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/crud";
import {
  slotsToTemplateRecord,
  templateRowToSlots,
} from "@/lib/path-carver/template-mapping";
import type {
  PathCarverDesireBundle,
  SavePathCarverInput,
} from "@/lib/path-carver/types";
import {
  validateBuildStep,
  validateDesireName,
  validateReview2Demands,
} from "@/lib/path-carver/validation";
import type { DesireDemandRow } from "@/lib/simulator/types";
import {
  adminUnavailableResult,
  isAdminRuntimeEnabled,
} from "@/lib/admin-runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSimulatorAwakenerOptions } from "@/lib/actions/simulator";
import { getSimulatorGearOptions } from "@/lib/actions/simulator-flow";
import { buildAwakenerOptionMap } from "@/components/simulator/awakener-selection";
import {
  buildCovenantOptionMap,
  buildWheelOptionMap,
} from "@/lib/simulator/gear-selection";

function nowIso(): string {
  return new Date().toISOString();
}

function revalidatePathCarverTables(): void {
  revalidatePath("/path-carver");
  revalidatePath("/simulator");
  for (const table of [
    "desire",
    "desire_template",
    "desire_anchored_awakener",
    "desire_demand",
  ]) {
    revalidatePath(`/tables/${table}`);
  }
}

export async function getPathCarverDesireBundle(
  desireId: number,
): Promise<ActionResult<PathCarverDesireBundle>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  try {
    const supabase = createAdminClient();

    const [desireResult, templateResult, anchorsResult, demandsResult] =
      await Promise.all([
        supabase
          .from("desire")
          .select("id, name, description, desire_type")
          .eq("id", desireId)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase
          .from("desire_template")
          .select("*")
          .eq("desire_id", desireId)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase
          .from("desire_anchored_awakener")
          .select("awakener_id, is_damage_dealer")
          .eq("desire_id", desireId)
          .is("deleted_at", null),
        supabase
          .from("desire_demand")
          .select(
            "id, tag_id, base_priority_weight, target_value, curve, decay_rate, tag:tag_id(tag_name)",
          )
          .eq("desire_id", desireId)
          .is("deleted_at", null),
      ]);

    if (desireResult.error) {
      return { success: false, error: desireResult.error.message };
    }
    if (!desireResult.data) {
      return { success: false, error: "Desire not found" };
    }
    if (templateResult.error) {
      return { success: false, error: templateResult.error.message };
    }
    if (anchorsResult.error) {
      return { success: false, error: anchorsResult.error.message };
    }
    if (demandsResult.error) {
      return { success: false, error: demandsResult.error.message };
    }

    const demands: DesireDemandRow[] = (demandsResult.data ?? []).map(
      (row) => {
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
      },
    );

    const template = templateResult.data
      ? {
          id: templateResult.data.id,
          ...templateRowToSlots(templateResult.data),
        }
      : null;

    const bundle: PathCarverDesireBundle = {
      desire: {
        id: desireResult.data.id,
        name: desireResult.data.name ?? `Desire #${desireResult.data.id}`,
        description: desireResult.data.description,
        desireType: desireResult.data.desire_type,
      },
      template,
      anchoredAwakeners: (anchorsResult.data ?? [])
        .filter(
          (r): r is typeof r & { awakener_id: number } => r.awakener_id != null,
        )
        .map((r) => ({
          awakenerId: r.awakener_id,
          isDamageDealer: Boolean(r.is_damage_dealer),
        })),
      demands,
    };

    return { success: true, data: bundle };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load desire bundle",
    };
  }
}

async function syncAnchoredAwakeners(
  supabase: ReturnType<typeof createAdminClient>,
  desireId: number,
  anchoredAwakeners: SavePathCarverInput["anchoredAwakeners"],
): Promise<ActionResult> {
  const { data: existingRows, error: existingError } = await supabase
    .from("desire_anchored_awakener")
    .select("id, awakener_id, is_damage_dealer")
    .eq("desire_id", desireId)
    .is("deleted_at", null);

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  const submittedByAwakener = new Map(
    anchoredAwakeners.map((anchor) => [anchor.awakenerId, anchor]),
  );
  const existingByAwakener = new Map(
    (existingRows ?? [])
      .filter(
        (row): row is typeof row & { awakener_id: number } =>
          row.awakener_id != null,
      )
      .map((row) => [row.awakener_id, row]),
  );

  for (const row of existingRows ?? []) {
    if (row.awakener_id != null && submittedByAwakener.has(row.awakener_id)) {
      continue;
    }

    const { error } = await supabase
      .from("desire_anchored_awakener")
      .update({ deleted_at: nowIso(), updated_at: nowIso() } as never)
      .eq("id", row.id);

    if (error) return { success: false, error: error.message };
  }

  for (const anchor of anchoredAwakeners) {
    const existing = existingByAwakener.get(anchor.awakenerId);

    if (existing) {
      if (Boolean(existing.is_damage_dealer) === anchor.isDamageDealer) {
        continue;
      }

      const { error } = await supabase
        .from("desire_anchored_awakener")
        .update({
          is_damage_dealer: anchor.isDamageDealer,
          updated_at: nowIso(),
        } as never)
        .eq("id", existing.id);

      if (error) return { success: false, error: error.message };
      continue;
    }

    const { error } = await supabase.from("desire_anchored_awakener").insert({
      desire_id: desireId,
      awakener_id: anchor.awakenerId,
      is_damage_dealer: anchor.isDamageDealer,
      created_at: nowIso(),
      updated_at: nowIso(),
    } as never);

    if (error) return { success: false, error: error.message };
  }

  return { success: true, data: undefined };
}

async function syncDemands(
  supabase: ReturnType<typeof createAdminClient>,
  desireId: number,
  demands: SavePathCarverInput["demands"],
  deletedDemandIds: number[],
): Promise<ActionResult> {
  const deleteIds = new Set(deletedDemandIds);

  for (const id of deleteIds) {
    const { error } = await supabase
      .from("desire_demand")
      .update({ deleted_at: nowIso(), updated_at: nowIso() } as never)
      .eq("id", id)
      .eq("desire_id", desireId);

    if (error) return { success: false, error: error.message };
  }

  for (const demand of demands) {
    const record = {
      desire_id: desireId,
      tag_id: demand.tagId,
      target_value: demand.targetValue,
      base_priority_weight: demand.basePriorityWeight,
      curve: demand.curve,
      decay_rate: demand.decayRate,
      updated_at: nowIso(),
    };

    if (demand.id != null) {
      const { error } = await supabase
        .from("desire_demand")
        .update(record as never)
        .eq("id", demand.id)
        .eq("desire_id", desireId);

      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabase.from("desire_demand").insert({
        ...record,
        created_at: nowIso(),
      } as never);

      if (error) return { success: false, error: error.message };
    }
  }

  return { success: true, data: undefined };
}

async function upsertTemplate(
  supabase: ReturnType<typeof createAdminClient>,
  desireId: number,
  slots: SavePathCarverInput["slots"],
  posseId: number | null,
  existingTemplateId?: number,
): Promise<ActionResult> {
  const templateRecord = slotsToTemplateRecord(desireId, slots, posseId);
  templateRecord.updated_at = nowIso();

  if (existingTemplateId != null) {
    const { error } = await supabase
      .from("desire_template")
      .update(templateRecord as never)
      .eq("id", existingTemplateId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  const { data: existing } = await supabase
    .from("desire_template")
    .select("id")
    .eq("desire_id", desireId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("desire_template")
      .update(templateRecord as never)
      .eq("id", existing.id);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  templateRecord.created_at = nowIso();
  const { error } = await supabase
    .from("desire_template")
    .insert(templateRecord as never);

  if (error) return { success: false, error: error.message };
  return { success: true, data: undefined };
}

export async function savePathCarverDesire(
  input: SavePathCarverInput,
): Promise<ActionResult<{ desireId: number }>> {
  if (!isAdminRuntimeEnabled()) return adminUnavailableResult();
  const nameCheck = validateDesireName(input.name);
  if (!nameCheck.valid) {
    return { success: false, error: nameCheck.errors.join("; ") };
  }

  const awakenerOptionsResult = await getSimulatorAwakenerOptions();
  if (!awakenerOptionsResult.success) {
    return { success: false, error: awakenerOptionsResult.error };
  }
  const gearOptionsResult = await getSimulatorGearOptions();
  if (!gearOptionsResult.success) {
    return { success: false, error: gearOptionsResult.error };
  }
  const optionMap = buildAwakenerOptionMap(awakenerOptionsResult.data);
  const covenantMap = buildCovenantOptionMap(gearOptionsResult.data.covenant);
  const wheelMap = buildWheelOptionMap(gearOptionsResult.data.wheel);

  const buildCheck = validateBuildStep(
    input.slots,
    input.anchoredAwakeners,
    optionMap,
    covenantMap,
    wheelMap,
  );
  if (!buildCheck.valid) {
    return { success: false, error: buildCheck.errors.join("; ") };
  }

  const demandCheck = validateReview2Demands(input.demands);
  if (!demandCheck.valid) {
    return { success: false, error: demandCheck.errors.join("; ") };
  }

  const desireType =
    input.anchoredAwakeners.length > 0 ? "specific" : "general";

  let createdDesireId: number | null = null;

  try {
    const supabase = createAdminClient();
    let savedDesireId = input.desireId ?? null;
    let existingTemplateId: number | undefined;

    if (savedDesireId != null) {
      const bundleResult = await getPathCarverDesireBundle(savedDesireId);
      if (bundleResult.success && bundleResult.data.template) {
        existingTemplateId = bundleResult.data.template.id;
      }

      const { error } = await supabase
        .from("desire")
        .update({
          name: input.name.trim(),
          description: input.description,
          desire_type: desireType,
          updated_at: nowIso(),
        } as never)
        .eq("id", savedDesireId);

      if (error) return { success: false, error: error.message };
    } else {
      const { data, error } = await supabase
        .from("desire")
        .insert({
          name: input.name.trim(),
          description: input.description,
          desire_type: desireType,
          created_at: nowIso(),
          updated_at: nowIso(),
        } as never)
        .select("id")
        .single();

      if (error) return { success: false, error: error.message };
      savedDesireId = data.id;
      createdDesireId = data.id;
    }

    const templateResult = await upsertTemplate(
      supabase,
      savedDesireId,
      input.slots,
      input.posseId,
      existingTemplateId,
    );
    if (!templateResult.success) {
      throw new Error(templateResult.error);
    }

    const anchorResult = await syncAnchoredAwakeners(
      supabase,
      savedDesireId,
      input.anchoredAwakeners,
    );
    if (!anchorResult.success) {
      throw new Error(anchorResult.error);
    }

    const demandResult = await syncDemands(
      supabase,
      savedDesireId,
      input.demands,
      input.deletedDemandIds,
    );
    if (!demandResult.success) {
      throw new Error(demandResult.error);
    }

    revalidatePathCarverTables();
    return { success: true, data: { desireId: savedDesireId } };
  } catch (error) {
    if (createdDesireId != null) {
      const supabase = createAdminClient();
      await supabase
        .from("desire")
        .update({ deleted_at: nowIso(), updated_at: nowIso() } as never)
        .eq("id", createdDesireId);
    }

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to save desire",
    };
  }
}
