/**
 * Append Helot OE Lasting Loathe records (replaces E1 with base_copies: 4).
 * Does not modify or delete existing records.
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

const AWAKENER_ID = 25;
const LASTING_LOATHE_E1_SELF_DAMAGE_ID = 674;
const LASTING_LOATHE_E1_DAMAGE_ID = 675;
const LASTING_LOATHE_E1_CREATE_STRIKE_ID = 676;

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
    "sample-data/kit-reader/helot.kit.json",
  );

  await assertLivePending(supabase, LASTING_LOATHE_E1_SELF_DAMAGE_ID);
  await assertLivePending(supabase, LASTING_LOATHE_E1_DAMAGE_ID);
  await assertLivePending(supabase, LASTING_LOATHE_E1_CREATE_STRIKE_ID);

  const fullRaw = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "sample-data/kit-reader/helot.proposal.json"),
      "utf8",
    ),
  );
  const full = kitProposalFileSchema.parse(fullRaw);

  const replacesMap: Record<string, number> = {
    "lasting-loathe-oe-self-damage": LASTING_LOATHE_E1_SELF_DAMAGE_ID,
    "lasting-loathe-oe-damage": LASTING_LOATHE_E1_DAMAGE_ID,
    "lasting-loathe-oe-create-strike": LASTING_LOATHE_E1_CREATE_STRIKE_ID,
  };

  const inserted: unknown[] = [];

  for (const [clientKey, replacesId] of Object.entries(replacesMap)) {
    const proposal = full.proposals.find((p) => p.clientKey === clientKey);
    if (!proposal) throw new Error(`Missing proposal for ${clientKey}`);
    const row = await insertProposal(
      supabase,
      proposal,
      AWAKENER_ID,
      maps,
      sourceLabelIndex,
      replacesId,
    );
    inserted.push({ clientKey: proposal.clientKey, ...row });
  }

  console.log(JSON.stringify({ insertedCount: inserted.length, inserted }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
