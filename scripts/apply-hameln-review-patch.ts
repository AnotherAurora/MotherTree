/**
 * Apply Hameln Kit Reader review patch:
 * - Update live pending ids 628/629 (not soft-deleted)
 * - Append base patch rows
 * - Insert OE replace chain with DB id mapping
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAdminRuntimeEnabled } from "../src/lib/admin-runtime";
import {
  AFTEREFFECT_MATH_OPERATIONS,
  UNIQUE_SCALING_MATH_OPERATIONS,
  hasLocalInteractionColumnMismatch,
} from "../src/lib/admin-local-interaction";
import type { Database } from "../src/lib/database.types";
import {
  kitProposalFileSchema,
  type KitAtmProposal,
} from "../src/lib/kit-reader/proposal-schema";
import { defaultTargetTypeForTag, isAoeTagPrefix } from "../src/lib/kit-reader/proposal-heuristics";
import { resolveInsertMetadata } from "../src/lib/kit-reader/atm-metadata";
import {
  loadKitPackSourceLabelIndex,
  resolveSourceLabelFromIndex,
} from "../src/lib/kit-reader/resolve-source-label";

const AWAKENER_ID = 24;
const SOUL_OVERTURE_DAMAGE_ID = 628;
const PRIMAL_CHORD_DAMAGE_ID = 629;

const MARVELOUS_AFTEREFFECT_LOCALS: KitAtmProposal["locals"] = [
  {
    mode: "aftereffect",
    modifierTagName: null,
    targetTagName: "Attacker.Bleed",
    dependencyStat: null,
    mathOperation: "multiply",
    valueScalar: 1.5,
    targetType: "aoe",
    layer: "add",
    isDisabled: false,
  },
  {
    mode: "aftereffect",
    modifierTagName: null,
    targetTagName: "Attacker.Poison",
    dependencyStat: null,
    mathOperation: "multiply",
    valueScalar: 0.75,
    targetType: "aoe",
    layer: "add",
    isDisabled: false,
  },
];

function createScriptClient(): SupabaseClient<Database> {
  if (!isAdminRuntimeEnabled()) {
    throw new Error("Local-only: ADMIN_ENABLED=true required.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase env in .env.local");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

async function loadNameMaps(supabase: SupabaseClient<Database>) {
  const { data: tags, error } = await supabase
    .from("tag")
    .select("id, tag_name")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  const tagByName = new Map(
    (tags ?? []).map((row) => [row.tag_name, row.id] as const),
  );
  return { tagByName };
}

type NameMaps = Awaited<ReturnType<typeof loadNameMaps>>;

function resolveLocalRow(
  local: KitAtmProposal["locals"][number],
  manifestationId: number,
  maps: NameMaps,
): Record<string, unknown> {
  const allowedOps: readonly string[] =
    local.mode === "aftereffect"
      ? AFTEREFFECT_MATH_OPERATIONS
      : UNIQUE_SCALING_MATH_OPERATIONS;
  if (!allowedOps.includes(local.mathOperation)) {
    throw new Error(`Invalid local op ${local.mathOperation}`);
  }
  const modifierTagId =
    local.modifierTagName != null
      ? (maps.tagByName.get(local.modifierTagName) ?? null)
      : null;
  const targetTagId =
    local.targetTagName != null
      ? (maps.tagByName.get(local.targetTagName) ?? null)
      : null;
  if (local.modifierTagName != null && modifierTagId == null) {
    throw new Error(`Unknown modifier ${local.modifierTagName}`);
  }
  if (local.targetTagName != null && targetTagId == null) {
    throw new Error(`Unknown target ${local.targetTagName}`);
  }
  const row = {
    manifestation_id: manifestationId,
    mode: local.mode,
    modifier_tag_id: modifierTagId,
    target_tag_id: targetTagId,
    dependency_stat: local.dependencyStat,
    math_operation: local.mathOperation,
    value_scalar: local.valueScalar,
    target_type: local.targetType,
    layer: local.layer,
    is_disabled: local.isDisabled,
  };
  if (hasLocalInteractionColumnMismatch(row)) {
    throw new Error(`Local column mismatch on ${manifestationId}`);
  }
  let targetType: "self" | "single" | "aoe" =
    local.mode === "unique_scaling" ? "self" : (local.targetType ?? "aoe");
  if (
    local.mode === "aftereffect" &&
    local.targetTagName != null &&
    isAoeTagPrefix(local.targetTagName)
  ) {
    targetType = "aoe";
  }
  return { ...row, target_type: targetType, created_at: nowIso(), updated_at: nowIso() };
}

function resolveAtmInsertRow(
  proposal: KitAtmProposal,
  awakenerId: number,
  maps: NameMaps,
  replacesManifestationId: number | null,
  sourceLabelIndex: Map<string, string>,
): { row: Record<string, unknown>; metadata: string } {
  const tagId = maps.tagByName.get(proposal.tagName);
  if (tagId == null) throw new Error(`Unknown tag ${proposal.tagName}`);
  const sourceLabel = resolveSourceLabelFromIndex(
    sourceLabelIndex,
    proposal.sourceKitId,
    proposal.sourceLabel,
  );
  const metadata = resolveInsertMetadata({
    tagName: proposal.tagName,
    sourceLabel,
    requiredEnlightenment: proposal.requiredEnlightenment,
    metadataOverride: proposal.metadataOverride,
    metadataSuffix: proposal.metadataSuffix,
  });
  let targetType = proposal.targetType;
  if (defaultTargetTypeForTag(proposal.tagName) === "aoe") targetType = "aoe";
  return {
    metadata,
    row: {
      awakener_id: awakenerId,
      tag_id: tagId,
      value_scalar: proposal.valueScalar,
      dependency_stat: proposal.dependencyStat,
      instance_count: proposal.instanceCount,
      base_copies: proposal.baseCopies,
      copy_provider_group_id: null,
      required_enlightenment: proposal.requiredEnlightenment,
      required_realm: null,
      source_type: proposal.sourceType,
      target_type: targetType,
      trigger_condition: null,
      is_accumulating: proposal.isAccumulating,
      is_permanent: proposal.isPermanent,
      buff_target_type_restriction: proposal.buffTargetTypeRestriction,
      metadata,
      replaces_manifestation_id: replacesManifestationId,
      verified: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  };
}

async function assertLivePending(
  supabase: SupabaseClient<Database>,
  id: number,
): Promise<void> {
  const { data, error } = await supabase
    .from("awakener_tag_manifestation")
    .select("id, deleted_at, verified")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.deleted_at != null) {
    throw new Error(`ATM id ${id} is missing or soft-deleted; aborting.`);
  }
  if (data.verified) {
    throw new Error(`ATM id ${id} is verified; aborting.`);
  }
}

async function insertProposal(
  supabase: SupabaseClient<Database>,
  proposal: KitAtmProposal,
  awakenerId: number,
  maps: NameMaps,
  sourceLabelIndex: Map<string, string>,
  replacesId: number | null,
): Promise<{ id: number; metadata: string; locals: number }> {
  const resolved = resolveAtmInsertRow(
    proposal,
    awakenerId,
    maps,
    replacesId,
    sourceLabelIndex,
  );
  const { data, error } = await supabase
    .from("awakener_tag_manifestation")
    .insert(resolved.row as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = Number(data.id);
  if (proposal.locals.length > 0) {
    const rows = proposal.locals.map((local) => resolveLocalRow(local, id, maps));
    const { error: localError } = await supabase
      .from("awakener_local_manifestation_interaction")
      .insert(rows as never);
    if (localError) throw new Error(localError.message);
  }
  return { id, metadata: resolved.metadata, locals: proposal.locals.length };
}

async function main() {
  const supabase = createScriptClient();
  const maps = await loadNameMaps(supabase);
  const sourceLabelIndex = loadKitPackSourceLabelIndex(
    "sample-data/kit-reader/hameln.kit.json",
  );

  const updated: unknown[] = [];
  const inserted: unknown[] = [];

  await assertLivePending(supabase, SOUL_OVERTURE_DAMAGE_ID);
  await assertLivePending(supabase, PRIMAL_CHORD_DAMAGE_ID);

  const { error: up628 } = await supabase
    .from("awakener_tag_manifestation")
    .update({ instance_count: 5, updated_at: nowIso() })
    .eq("id", SOUL_OVERTURE_DAMAGE_ID)
    .is("deleted_at", null);
  if (up628) throw new Error(up628.message);
  updated.push({ id: SOUL_OVERTURE_DAMAGE_ID, instance_count: 5 });

  for (const manifestId of [SOUL_OVERTURE_DAMAGE_ID, PRIMAL_CHORD_DAMAGE_ID]) {
    const { count, error: countErr } = await supabase
      .from("awakener_local_manifestation_interaction")
      .select("id", { count: "exact", head: true })
      .eq("manifestation_id", manifestId)
      .is("deleted_at", null);
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) continue;
    const rows = MARVELOUS_AFTEREFFECT_LOCALS.map((local) =>
      resolveLocalRow(local, manifestId, maps),
    );
    const { error: localErr } = await supabase
      .from("awakener_local_manifestation_interaction")
      .insert(rows as never);
    if (localErr) throw new Error(localErr.message);
    updated.push({ id: manifestId, localsAdded: rows.length });
  }

  const patchRaw = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "sample-data/kit-reader/hameln.review.patch.json"),
      "utf8",
    ),
  );
  const patch = kitProposalFileSchema.parse(patchRaw);
  const clientKeyToId = new Map<string, number>([
    ["soul-overture-damage", SOUL_OVERTURE_DAMAGE_ID],
    ["primal-chord-damage", PRIMAL_CHORD_DAMAGE_ID],
  ]);

  for (const proposal of patch.proposals.filter((p) => p.status === "ok")) {
    const row = await insertProposal(
      supabase,
      proposal,
      AWAKENER_ID,
      maps,
      sourceLabelIndex,
      null,
    );
    clientKeyToId.set(proposal.clientKey, row.id);
    inserted.push({ clientKey: proposal.clientKey, ...row });
  }

  const fullRaw = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "sample-data/kit-reader/hameln.proposal.json"),
      "utf8",
    ),
  );
  const full = kitProposalFileSchema.parse(fullRaw);
  const oeKeys = full.proposals.filter(
    (p) => p.status === "ok" && p.clientKey.startsWith("oe-"),
  );
  const oeBases = oeKeys.filter((p) => p.replacesClientKey == null);
  const oeReplacers = oeKeys.filter((p) => p.replacesClientKey != null);

  for (const proposal of [...oeBases, ...oeReplacers]) {
    const replacesId =
      proposal.replacesClientKey != null
        ? (clientKeyToId.get(proposal.replacesClientKey) ?? null)
        : null;
    if (proposal.replacesClientKey != null && replacesId == null) {
      throw new Error(`Missing replace target for ${proposal.clientKey}`);
    }
    const row = await insertProposal(
      supabase,
      proposal,
      AWAKENER_ID,
      maps,
      sourceLabelIndex,
      replacesId,
    );
    clientKeyToId.set(proposal.clientKey, row.id);
    inserted.push({ clientKey: proposal.clientKey, ...row });
  }

  console.log(JSON.stringify({ updated, insertedCount: inserted.length, inserted }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
