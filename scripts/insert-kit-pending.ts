/**
 * Insert Kit Reader proposals as pending ATMs (verified=false).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/insert-kit-pending.ts sample-data/kit-reader/{slug}.proposal.json
 *
 * Requires local ADMIN_ENABLED=true (not Vercel). Aborts if the awakener already
 * has alive pending ATMs. No --force.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAdminRuntimeEnabled } from "../src/lib/admin-runtime";
import {
  AFTEREFFECT_MATH_OPERATIONS,
  UNIQUE_SCALING_MATH_OPERATIONS,
  DIRECT_MODIFIER_MATH_OPERATIONS,
  mathOperationsForMode,
  hasLocalInteractionColumnMismatch,
} from "../src/lib/admin-local-interaction";
import type { Database } from "../src/lib/database.types";
import {
  kitProposalFileSchema,
  type KitAtmProposal,
  type KitProposalFile,
} from "../src/lib/kit-reader/proposal-schema";
import {
  defaultTargetTypeForTag,
  isAoeTagPrefix,
  DEVOUR_COPY_PROVIDER_GROUP_NAME,
  detectDevourClause,
  warnPercentDepValueScalarLooksLinear,
  warnStealMissingStrUpPair,
  warnDevourUsingWhenTrigger,
} from "../src/lib/kit-reader/proposal-heuristics";
import { resolveInsertMetadata } from "../src/lib/kit-reader/atm-metadata";
import {
  loadKitPackSourceLabelIndex,
  resolveSourceLabelFromIndex,
} from "../src/lib/kit-reader/resolve-source-label";

const IGNORE_SOURCE_PATTERNS = [
  /gnostic.?potential/i,
  /madness.?omen/i,
  /dimensional.?image/i,
];

function createScriptClient(): SupabaseClient<Database> {
  if (!isAdminRuntimeEnabled()) {
    throw new Error(
      "Kit Reader insert CLI is local-only. Set ADMIN_ENABLED=true and do not run on Vercel.",
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function isIgnoreListed(proposal: KitAtmProposal): boolean {
  const haystack = `${proposal.sourceKitId} ${proposal.sourceQuote ?? ""} ${proposal.tagName}`;
  return IGNORE_SOURCE_PATTERNS.some((re) => re.test(haystack));
}

async function countPending(
  supabase: SupabaseClient<Database>,
  awakenerId: number,
): Promise<number> {
  const { count, error } = await supabase
    .from("awakener_tag_manifestation")
    .select("id", { count: "exact", head: true })
    .eq("awakener_id", awakenerId)
    .eq("verified", false)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function resolveAwakenerId(
  supabase: SupabaseClient<Database>,
  file: KitProposalFile,
): Promise<{ id: number; name: string }> {
  if (file.awakenerId != null) {
    const { data, error } = await supabase
      .from("awakener")
      .select("id, name")
      .eq("id", file.awakenerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Awakener id ${file.awakenerId} not found`);
    return { id: Number(data.id), name: String(data.name ?? "") };
  }

  const { data, error } = await supabase
    .from("awakener")
    .select("id, name")
    .eq("name", file.awakenerName)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(`Awakener named "${file.awakenerName}" not found`);
  }
  return { id: Number(data.id), name: String(data.name ?? "") };
}

async function loadNameMaps(supabase: SupabaseClient<Database>) {
  const [tags, realms, groups] = await Promise.all([
    supabase.from("tag").select("id, tag_name").is("deleted_at", null),
    supabase.from("realm").select("id, name").is("deleted_at", null),
    supabase
      .from("copy_provider_group")
      .select("id, name")
      .is("deleted_at", null),
  ]);
  if (tags.error) throw new Error(tags.error.message);
  if (realms.error) throw new Error(realms.error.message);
  if (groups.error) throw new Error(groups.error.message);

  const tagByName = new Map(
    (tags.data ?? []).map((row) => [row.tag_name, row.id] as const),
  );
  const realmByName = new Map(
    (realms.data ?? []).map((row) => [row.name, row.id] as const),
  );
  const groupByName = new Map(
    (groups.data ?? []).map((row) => [row.name, row.id] as const),
  );
  return { tagByName, realmByName, groupByName };
}

type NameMaps = Awaited<ReturnType<typeof loadNameMaps>>;

function resolveAtmRow(
  proposal: KitAtmProposal,
  awakenerId: number,
  maps: NameMaps,
  replacesManifestationId: number | null,
  sourceLabelIndex: Map<string, string>,
): { row: Record<string, unknown>; metadata: string; sourceLabel: string } {
  const tagId = maps.tagByName.get(proposal.tagName);
  if (tagId == null) {
    throw new Error(`Unknown tagName "${proposal.tagName}"`);
  }

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
    isDevour:
      proposal.copyProviderGroupName === DEVOUR_COPY_PROVIDER_GROUP_NAME ||
      detectDevourClause(proposal.sourceQuote),
  });

  let requiredRealm: number | null = null;
  if (proposal.requiredRealmName != null) {
    requiredRealm = maps.realmByName.get(proposal.requiredRealmName) ?? null;
    if (requiredRealm == null) {
      throw new Error(`Unknown requiredRealmName "${proposal.requiredRealmName}"`);
    }
  }

  let copyProviderGroupId: number | null = null;
  if (proposal.copyProviderGroupName != null) {
    copyProviderGroupId =
      maps.groupByName.get(proposal.copyProviderGroupName) ?? null;
    if (copyProviderGroupId == null) {
      throw new Error(
        `Unknown copyProviderGroupName "${proposal.copyProviderGroupName}"`,
      );
    }
  }

  let triggerCondition: number | null = null;
  if (proposal.triggerConditionTagName != null) {
    triggerCondition =
      maps.tagByName.get(proposal.triggerConditionTagName) ?? null;
    if (triggerCondition == null) {
      throw new Error(
        `Unknown triggerConditionTagName "${proposal.triggerConditionTagName}"`,
      );
    }
  }

  let targetType = proposal.targetType;
  if (defaultTargetTypeForTag(proposal.tagName) === "aoe") {
    targetType = "aoe";
  }

  return {
    row: {
      awakener_id: awakenerId,
      tag_id: tagId,
      value_scalar: proposal.valueScalar,
      dependency_stat: proposal.dependencyStat,
      instance_count: proposal.instanceCount,
      base_copies: proposal.baseCopies,
      copy_provider_group_id: copyProviderGroupId,
      required_enlightenment: proposal.requiredEnlightenment,
      required_realm: requiredRealm,
      source_type: proposal.sourceType,
      target_type: targetType,
      trigger_condition: triggerCondition,
      is_accumulating: proposal.isAccumulating,
      is_permanent: proposal.isPermanent,
      buff_target_type_restriction: proposal.buffTargetTypeRestriction,
      metadata,
      replaces_manifestation_id: replacesManifestationId,
      verified: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    metadata,
    sourceLabel,
  };
}

function resolveLocalRow(
  local: KitAtmProposal["locals"][number],
  manifestationId: number,
  maps: NameMaps,
): Record<string, unknown> {
  const allowedOps: readonly string[] = mathOperationsForMode(local.mode);
  if (!allowedOps.includes(local.mathOperation)) {
    throw new Error(
      `Local mathOperation "${local.mathOperation}" not allowed for mode ${local.mode}`,
    );
  }

  const modifierTagId =
    local.modifierTagName != null
      ? (maps.tagByName.get(local.modifierTagName) ?? null)
      : null;
  if (local.modifierTagName != null && modifierTagId == null) {
    throw new Error(`Unknown modifierTagName "${local.modifierTagName}"`);
  }

  const targetTagId =
    local.targetTagName != null
      ? (maps.tagByName.get(local.targetTagName) ?? null)
      : null;
  if (local.targetTagName != null && targetTagId == null) {
    throw new Error(`Unknown targetTagName "${local.targetTagName}"`);
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
    throw new Error(
      `Local column mismatch for manifestation ${manifestationId} (mode=${local.mode})`,
    );
  }

  let targetType: "self" | "single" | "aoe";
  if (local.mode === "unique_scaling" || local.mode === "direct_modifier") {
    targetType = "self";
  } else {
    targetType = local.targetType ?? "aoe";
    if (
      local.targetTagName != null &&
      isAoeTagPrefix(local.targetTagName)
    ) {
      targetType = "aoe";
    }
  }

  return {
    ...row,
    target_type: targetType,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

async function insertAtm(
  supabase: SupabaseClient<Database>,
  row: Record<string, unknown>,
): Promise<number> {
  const { data, error } = await supabase
    .from("awakener_tag_manifestation")
    .insert(row as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return Number(data.id);
}

async function insertLocals(
  supabase: SupabaseClient<Database>,
  proposal: KitAtmProposal,
  manifestationId: number,
  maps: NameMaps,
): Promise<number> {
  if (proposal.locals.length === 0) return 0;
  const rows = proposal.locals.map((local) =>
    resolveLocalRow(local, manifestationId, maps),
  );
  const { error } = await supabase
    .from("awakener_local_manifestation_interaction")
    .insert(rows as never);
  if (error) throw new Error(error.message);
  return rows.length;
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const proposalArg = args.find((a) => !a.startsWith("--"));

  if (!proposalArg) {
    console.error(
      "Usage: npx tsx --env-file=.env.local scripts/insert-kit-pending.ts <proposal.json> [--append|--upsert|--patch]",
    );
    process.exit(1);
  }

  const isAppendMode =
    flags.has("--append") ||
    flags.has("--upsert") ||
    flags.has("--patch") ||
    process.env.KIT_READER_APPEND === "true";

  const absolute = resolve(process.cwd(), proposalArg);
  const raw = JSON.parse(readFileSync(absolute, "utf8"));
  const parsed = kitProposalFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Proposal failed Zod validation:");
    console.error(parsed.error.flatten());
    process.exit(1);
  }

  const file = parsed.data;
  const supabase = createScriptClient();
  const awakener = await resolveAwakenerId(supabase, file);

  const pending = await countPending(supabase, awakener.id);
  if (pending > 0 && !isAppendMode) {
    console.error(
      `Abort: awakener ${awakener.name} (id=${awakener.id}) has ${pending} pending ATM(s). Verify or soft-delete them before a new Kit Reader batch. No --force. Pass --append / --patch (or set KIT_READER_APPEND=true) to add/patch rows in an existing pending batch.`,
    );
    process.exit(1);
  }

  const maps = await loadNameMaps(supabase);
  const sourceLabelIndex = loadKitPackSourceLabelIndex(file.kitPackPath);
  const ok = file.proposals.filter((p) => p.status === "ok");
  const skipped = file.proposals.filter((p) => p.status !== "ok");

  const clientKeyToId = new Map<string, number>();
  const inserted: { clientKey: string; id: number; locals: number }[] = [];
  const metadataResolved: {
    clientKey: string;
    metadata: string;
    sourceLabel: string;
    metadataOverride?: string | null;
    metadataSuffix?: string | null;
  }[] = [];
  const failed: { clientKey: string; reason: string }[] = [];
  const warnings: { clientKey: string; message: string }[] = [];

  for (const proposal of ok) {
    const warning = warnPercentDepValueScalarLooksLinear(
      proposal.clientKey,
      proposal.dependencyStat,
      proposal.valueScalar,
      proposal.sourceQuote,
      proposal.rationale,
    );
    if (warning != null) {
      warnings.push({
        clientKey: warning.clientKey,
        message: warning.message,
      });
    }
  }

  for (const stealWarning of warnStealMissingStrUpPair(ok)) {
    warnings.push({
      clientKey: stealWarning.clientKey,
      message: stealWarning.message,
    });
  }

  for (const devourWarning of warnDevourUsingWhenTrigger(ok)) {
    warnings.push({
      clientKey: devourWarning.clientKey,
      message: devourWarning.message,
    });
  }

  const bases = ok.filter((p) => p.replacesClientKey == null);
  const replacers = ok.filter((p) => p.replacesClientKey != null);

  async function processProposal(proposal: KitAtmProposal) {
    if (isIgnoreListed(proposal)) {
      failed.push({
        clientKey: proposal.clientKey,
        reason: "ignore-list source slipped through as ok",
      });
      return;
    }

    let replacesId: number | null = null;
    if (proposal.replacesClientKey != null) {
      replacesId = clientKeyToId.get(proposal.replacesClientKey) ?? null;
      if (replacesId == null && /^\d+$/.test(proposal.replacesClientKey)) {
        replacesId = Number(proposal.replacesClientKey);
      }
      if (replacesId == null) {
        failed.push({
          clientKey: proposal.clientKey,
          reason: `replacesClientKey "${proposal.replacesClientKey}" not found in inserted map or database IDs`,
        });
        return;
      }
    }

    try {
      const resolved = resolveAtmRow(
        proposal,
        awakener.id,
        maps,
        replacesId,
        sourceLabelIndex,
      );
      const id = await insertAtm(supabase, resolved.row);
      clientKeyToId.set(proposal.clientKey, id);
      const localCount = await insertLocals(supabase, proposal, id, maps);
      inserted.push({
        clientKey: proposal.clientKey,
        id,
        locals: localCount,
      });
      metadataResolved.push({
        clientKey: proposal.clientKey,
        metadata: resolved.metadata,
        sourceLabel: resolved.sourceLabel,
        ...(proposal.metadataOverride != null
          ? { metadataOverride: proposal.metadataOverride }
          : {}),
        ...(proposal.metadataSuffix != null
          ? { metadataSuffix: proposal.metadataSuffix }
          : {}),
      });
    } catch (error) {
      failed.push({
        clientKey: proposal.clientKey,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const proposal of bases) {
    await processProposal(proposal);
  }
  for (const proposal of replacers) {
    await processProposal(proposal);
  }

  console.log(
    JSON.stringify(
      {
        awakener,
        insertedCount: inserted.length,
        inserted,
        metadataResolved,
        skipped: skipped.map((p) => ({
          clientKey: p.clientKey,
          status: p.status,
          unsupportedReason: p.unsupportedReason,
          rationale: p.rationale,
        })),
        warnings,
        failed,
      },
      null,
      2,
    ),
  );

  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
