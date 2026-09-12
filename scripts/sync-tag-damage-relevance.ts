/**
 * Regenerate the tag.is_damage_relevant mirror.
 *
 * Computes the team-independent damage-reachability closure from
 * `tag_default_interaction` (anchored at the six Total Damage channels) plus the
 * code-driven synthetic seeds, then writes the result back to `public.tag`.
 *
 * Mirror only — the Relic Picker runtime computes the per-team closure in code.
 *
 * Run: npm run sync:damage-relevance
 *      npm run sync:damage-relevance -- --dry-run
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DAMAGE_SEED_TAG_IDS,
  computeDamageRelevance,
} from "../src/lib/path-carver/damage-relevance";
import { DAMAGE_CHANNEL_TAGS } from "../src/lib/path-carver/total-damage";
import { matchesDemandTag } from "../src/lib/simulator/tag-matching";
import type { Database } from "../src/lib/database.types";
import type { DefaultInteraction, Tag } from "../src/lib/team-data/types";

const DRY_RUN = process.argv.includes("--dry-run");
const PAGE_SIZE = 1000;

function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, then run: npm run sync:damage-relevance",
    );
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

async function fetchAll<T>(
  admin: SupabaseClient<Database>,
  table: "tag" | "tag_default_interaction",
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function main(): Promise<void> {
  const admin = createAdminClient();
  const tagRows = await fetchAll<Database["public"]["Tables"]["tag"]["Row"]>(
    admin,
    "tag",
  );
  const interactionRows = await fetchAll<
    Database["public"]["Tables"]["tag_default_interaction"]["Row"]
  >(admin, "tag_default_interaction");

  const tagsById: Record<number, Tag> = {};
  for (const row of tagRows) {
    tagsById[row.id] = {
      id: row.id,
      tagName: row.tag_name,
      layer: row.layer,
      isPercent: row.is_percent === true,
      isAdditive: row.is_additive !== false,
    };
  }

  const defaultInteractions: DefaultInteraction[] = interactionRows.map(
    (row) => {
      const modifier =
        row.modifier_tag_id != null ? tagsById[row.modifier_tag_id] : undefined;
      const target =
        row.target_tag_id != null ? tagsById[row.target_tag_id] : undefined;
      const exclusion =
        row.exclusion_suffix != null ? tagsById[row.exclusion_suffix] : undefined;
      return {
        id: row.id,
        modifierTagId: row.modifier_tag_id,
        modifierTagName: modifier?.tagName ?? "Unknown",
        targetTagId: row.target_tag_id,
        targetTagName: target?.tagName ?? "Unknown",
        exclusionTagId: row.exclusion_suffix,
        exclusionTagName: exclusion?.tagName ?? null,
        mathOperation: row.math_operation,
        defaultFactor: row.default_factor,
        buffTargetTypeRestriction: row.buff_target_type_restriction,
        createsBase: row.creates_base ?? false,
        amplifiesSubject: row.amplifies_subject ?? true,
      };
    },
  );

  const relevance = computeDamageRelevance({
    tagsById,
    defaultInteractions,
    manifestations: [],
  });

  const seedIds = new Set(DAMAGE_SEED_TAG_IDS);
  const seed: number[] = [];
  const graph: number[] = [];
  const none: number[] = [];
  for (const row of tagRows) {
    if (!relevance.tagIds.has(row.id)) {
      none.push(row.id);
    } else if (seedIds.has(row.id)) {
      seed.push(row.id);
    } else {
      graph.push(row.id);
    }
  }

  const channelCount = Object.values(tagsById).filter((tag) =>
    DAMAGE_CHANNEL_TAGS.some((channel) =>
      matchesDemandTag(tag.tagName, channel),
    ),
  ).length;

  console.log(
    `tags=${tagRows.length} interactions=${interactionRows.length} channels=${channelCount}`,
  );
  console.log(
    `relevant=${seed.length + graph.length} (seed=${seed.length}, graph=${graph.length}) irrelevant=${none.length}`,
  );

  if (DRY_RUN) {
    console.log("--dry-run: no rows written.");
    return;
  }

  for (const ids of chunk(seed, 500)) {
    const { error } = await admin
      .from("tag")
      .update({ is_damage_relevant: true, damage_relevance_reason: "seed" })
      .in("id", ids);
    if (error) throw new Error(`seed update: ${error.message}`);
  }
  for (const ids of chunk(graph, 500)) {
    const { error } = await admin
      .from("tag")
      .update({ is_damage_relevant: true, damage_relevance_reason: "graph" })
      .in("id", ids);
    if (error) throw new Error(`graph update: ${error.message}`);
  }
  for (const ids of chunk(none, 500)) {
    const { error } = await admin
      .from("tag")
      .update({ is_damage_relevant: false, damage_relevance_reason: null })
      .in("id", ids);
    if (error) throw new Error(`clear update: ${error.message}`);
  }

  console.log("Wrote tag.is_damage_relevant.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
