"use server";

import type { ActionResult } from "@/lib/actions/crud";
import {
  generateTeamForDesire,
  recommendEmptySlots,
} from "@/lib/simulator/generate-team";
import type {
  BanEntry,
  DesireDetail,
  DesireSummary,
  GenerateTeamInput,
  GenerateTeamResult,
  RecommendInput,
  SimulatorGearOptions,
  SlotState,
} from "@/lib/simulator/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type {
  BanEntry,
  DesireDetail,
  DesireSummary,
  GenerateTeamInput,
  GenerateTeamResult,
  RecommendInput,
  SimulatorGearOptions,
  SlotState,
} from "@/lib/simulator/types";

export async function getDesires(): Promise<ActionResult<DesireSummary[]>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("desire")
      .select("id, name, description, desire_demand(id)")
      .is("deleted_at", null)
      .order("name");

    if (error) return { success: false, error: error.message };

    const desires: DesireSummary[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name ?? `Desire #${row.id}`,
      description: row.description,
      demandCount: Array.isArray(row.desire_demand)
        ? row.desire_demand.length
        : 0,
    }));

    return { success: true, data: desires };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to load desires",
    };
  }
}

export async function getDesireDetail(
  desireId: number,
): Promise<ActionResult<DesireDetail>> {
  try {
    const supabase = createAdminClient();

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

    if (desireResult.error) return { success: false, error: desireResult.error.message };
    if (!desireResult.data) return { success: false, error: "Desire not found" };
    if (demandsResult.error) return { success: false, error: demandsResult.error.message };
    if (anchorsResult.error) return { success: false, error: anchorsResult.error.message };

    const detail: DesireDetail = {
      id: desireResult.data.id,
      name: desireResult.data.name ?? `Desire #${desireResult.data.id}`,
      description: desireResult.data.description,
      demands: (demandsResult.data ?? []).map((row) => {
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
      }),
      anchoredAwakenerIds: (anchorsResult.data ?? [])
        .map((r) => r.awakener_id)
        .filter((id): id is number => id != null),
    };

    return { success: true, data: detail };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to load desire detail",
    };
  }
}

export async function getSimulatorGearOptions(): Promise<
  ActionResult<SimulatorGearOptions>
> {
  try {
    const supabase = createAdminClient();

    const [posseResult, wheelResult, covenantResult] = await Promise.all([
      supabase.from("posse").select("id, name").is("deleted_at", null).order("name"),
      supabase.from("wheel").select("id, name").is("deleted_at", null).order("name"),
      supabase
        .from("covenant")
        .select("id, name")
        .is("deleted_at", null)
        .order("name"),
    ]);

    if (posseResult.error) return { success: false, error: posseResult.error.message };
    if (wheelResult.error) return { success: false, error: wheelResult.error.message };
    if (covenantResult.error) {
      return { success: false, error: covenantResult.error.message };
    }

    return {
      success: true,
      data: {
        posse: (posseResult.data ?? []).map((p) => ({
          value: p.id,
          label: p.name ?? `#${p.id}`,
        })),
        wheel: (wheelResult.data ?? []).map((w) => ({
          value: w.id,
          label: w.name ?? `#${w.id}`,
        })),
        covenant: (covenantResult.data ?? []).map((c) => ({
          value: c.id,
          label: c.name ?? `#${c.id}`,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load gear options",
    };
  }
}

export async function runGenerateTeamForDesire(
  input: GenerateTeamInput,
): Promise<ActionResult<GenerateTeamResult>> {
  try {
    const supabase = createAdminClient();
    const result = await generateTeamForDesire(
      supabase,
      input.desireId,
      input.startAwakenerId,
      input.banEntries,
    );
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate team",
    };
  }
}

export async function runRecommendEmptySlots(
  input: RecommendInput,
): Promise<ActionResult<{ slots: SlotState[]; posseId: number | null }>> {
  try {
    const supabase = createAdminClient();
    const result = await recommendEmptySlots(
      supabase,
      input.desireId,
      input.slots,
      input.posseId,
      input.banEntries,
    );
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to recommend slots",
    };
  }
}
