import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { SEED_DESIRE_NAMES } from "./simulator-seed-constants";

function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type SeedDesire = {
  name: string;
  description: string;
  desireType: "general" | "specific";
  demands: Array<{
    tagName: string;
    basePriorityWeight: number;
    targetValue: number;
    curve: "linear" | "exponential" | "logarithmic";
    decayRate: number;
  }>;
  anchoredAwakenerNames: string[];
  pathAwakenerNames: string[];
};

const SEED_DESIRES: SeedDesire[] = [
  {
    name: "Strike DPS",
    description: "Maximize attacker strike and tentacle output.",
    desireType: "specific",
    demands: [
      {
        tagName: "Attacker.Tentacle",
        basePriorityWeight: 2,
        targetValue: 3,
        curve: "linear",
        decayRate: 1,
      },
      {
        tagName: "Support.Crit Rate",
        basePriorityWeight: 1,
        targetValue: 2,
        curve: "logarithmic",
        decayRate: 1.2,
      },
    ],
    anchoredAwakenerNames: ["Aigis"],
    pathAwakenerNames: ["Aigis"],
  },
  {
    name: "Support Sustain",
    description: "Prioritize healing, shields, and defensive utility.",
    desireType: "general",
    demands: [
      {
        tagName: "Defender.Heal",
        basePriorityWeight: 2,
        targetValue: 2,
        curve: "linear",
        decayRate: 1,
      },
      {
        tagName: "Defender.Shield",
        basePriorityWeight: 1.5,
        targetValue: 2,
        curve: "exponential",
        decayRate: 0.8,
      },
      {
        tagName: "Defender.Base Death Resist",
        basePriorityWeight: 1,
        targetValue: 1,
        curve: "logarithmic",
        decayRate: 1,
      },
    ],
    anchoredAwakenerNames: [],
    pathAwakenerNames: [],
  },
  {
    name: "Counter Stack",
    description: "Build around counter gain and support modifiers.",
    desireType: "specific",
    demands: [
      {
        tagName: "Support.Increase Gain.Counter",
        basePriorityWeight: 2,
        targetValue: 2,
        curve: "linear",
        decayRate: 1,
      },
      {
        tagName: "Support.Crit Rate",
        basePriorityWeight: 1,
        targetValue: 1.5,
        curve: "logarithmic",
        decayRate: 1,
      },
    ],
    anchoredAwakenerNames: [],
    pathAwakenerNames: [],
  },
];

async function lookupTagId(
  supabase: SupabaseClient<Database>,
  tagName: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("tag")
    .select("id")
    .eq("tag_name", tagName)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Tag not found: ${tagName}`);
  return data.id;
}

async function lookupAwakenerId(
  supabase: SupabaseClient<Database>,
  name: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("awakener")
    .select("id")
    .eq("name", name)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Awakener not found: ${name}`);
  return data.id;
}

async function upsertDesireByName(
  supabase: SupabaseClient<Database>,
  seed: SeedDesire,
): Promise<number> {
  const { data: existing, error: existingError } = await supabase
    .from("desire")
    .select("id")
    .eq("name", seed.name)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { error } = await supabase
      .from("desire")
      .update({
        description: seed.description,
        desire_type: seed.desireType,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return existing.id;
  }

  const { data, error } = await supabase
    .from("desire")
    .insert({
      name: seed.name,
      description: seed.description,
      desire_type: seed.desireType,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

async function clearDesireChildren(
  supabase: SupabaseClient<Database>,
  desireId: number,
) {
  const now = new Date().toISOString();

  await supabase
    .from("desire_demand")
    .update({ deleted_at: now })
    .eq("desire_id", desireId)
    .is("deleted_at", null);

  await supabase
    .from("desire_anchored_awakener")
    .update({ deleted_at: now })
    .eq("desire_id", desireId)
    .is("deleted_at", null);

  const { data: existingPaths } = await supabase
    .from("path")
    .select("id")
    .eq("desire_id", desireId);

  if (existingPaths && existingPaths.length > 0) {
    await supabase
      .from("path")
      .delete()
      .eq("desire_id", desireId);
  }
}

async function main() {
  const supabase = createAdminClient();
  console.log("Seeding simulator desires...\n");

  const seedNames = new Set(SEED_DESIRES.map((d) => d.name));
  for (const name of SEED_DESIRE_NAMES) {
    if (!seedNames.has(name)) {
      throw new Error(`SEED_DESIRES is missing seed desire: ${name}`);
    }
  }

  for (const seed of SEED_DESIRES) {
    const desireId = await upsertDesireByName(supabase, seed);
    await clearDesireChildren(supabase, desireId);

    for (const demand of seed.demands) {
      const tagId = await lookupTagId(supabase, demand.tagName);
      const { error } = await supabase.from("desire_demand").insert({
        desire_id: desireId,
        tag_id: tagId,
        base_priority_weight: demand.basePriorityWeight,
        target_value: demand.targetValue,
        curve: demand.curve,
        decay_rate: demand.decayRate,
      });
      if (error) throw new Error(error.message);
    }

    for (const awakenerName of seed.anchoredAwakenerNames) {
      const awakenerId = await lookupAwakenerId(supabase, awakenerName);
      const { error } = await supabase
        .from("desire_anchored_awakener")
        .insert({ desire_id: desireId, awakener_id: awakenerId });
      if (error) throw new Error(error.message);
    }

    for (const awakenerName of seed.pathAwakenerNames) {
      const awakenerId = await lookupAwakenerId(supabase, awakenerName);
      const { error } = await supabase
        .from("path")
        .insert({ desire_id: desireId, awakener_id: awakenerId });
      if (error) throw new Error(error.message);
    }

    console.log(
      `  ✓ ${seed.name} (id=${desireId}, ${seed.demands.length} demands, ${seed.anchoredAwakenerNames.length} anchors)`,
    );
  }

  console.log("\nSeed complete.");
  console.log(
    "Optional: add entity bans in the simulator UI (awakener/posse/covenant/wheel IDs).",
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`db:seed-simulator failed: ${message}`);
  process.exit(1);
});
