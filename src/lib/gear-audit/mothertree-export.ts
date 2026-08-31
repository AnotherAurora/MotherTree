import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, TableName } from "@/lib/database.types";
import type { GearAuditKind } from "./finding-schema";
import { PACK_SCHEMA_VERSION, type MothertreeGearPack } from "./pack-schema";

const PAGE_SIZE = 1000;

function createScriptClient(): SupabaseClient<Database> {
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

async function fetchAllRows<T extends TableName>(
  supabase: SupabaseClient<Database>,
  table: T,
): Promise<Database["public"]["Tables"][T]["Row"][]> {
  const rows: Database["public"]["Tables"][T]["Row"][] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from(table).select("*").range(from, to);
    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
    const page = (data ?? []) as unknown as Database["public"]["Tables"][T]["Row"][];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function fetchParentsAndManifestations(
  client: SupabaseClient<Database>,
  auditKind: GearAuditKind,
): Promise<{
  parents: MothertreeGearPack["parents"];
  manifestations: MothertreeGearPack["manifestations"];
}> {
  switch (auditKind) {
    case "wheel": {
      const [parents, manifestations] = await Promise.all([
        fetchAllRows(client, "wheel"),
        fetchAllRows(client, "wheel_tag_manifestation"),
      ]);
      return { parents, manifestations };
    }
    case "covenant": {
      const [parents, manifestations] = await Promise.all([
        fetchAllRows(client, "covenant"),
        fetchAllRows(client, "covenant_tag_manifestation"),
      ]);
      return { parents, manifestations };
    }
    case "posse": {
      const [parents, manifestations] = await Promise.all([
        fetchAllRows(client, "posse"),
        fetchAllRows(client, "posse_tag_manifestation"),
      ]);
      return { parents, manifestations };
    }
  }
}

export async function buildMothertreeGearPack(
  auditKind: GearAuditKind,
  supabase?: SupabaseClient<Database>,
): Promise<MothertreeGearPack> {
  const client = supabase ?? createScriptClient();

  const [{ parents, manifestations }, tags, realms, awakeners] = await Promise.all([
    fetchParentsAndManifestations(client, auditKind),
    fetchAllRows(client, "tag"),
    fetchAllRows(client, "realm"),
    fetchAllRows(client, "awakener"),
  ]);

  const tagsById = Object.fromEntries(
    tags.map((tag) => [
      tag.id,
      {
        id: tag.id,
        tag_name: tag.tag_name,
        is_percent: tag.is_percent,
      },
    ]),
  );

  const realmsById = Object.fromEntries(
    realms.map((realm) => [realm.id, { id: realm.id, name: realm.name }]),
  );

  const awakenersById = Object.fromEntries(
    awakeners
      .filter((a) => a.name != null)
      .map((awakener) => [
        awakener.id,
        { id: awakener.id, name: awakener.name as string },
      ]),
  );

  return {
    schemaVersion: PACK_SCHEMA_VERSION,
    auditKind,
    exportedAt: new Date().toISOString(),
    parents: parents as MothertreeGearPack["parents"],
    manifestations: manifestations as MothertreeGearPack["manifestations"],
    tagsById,
    realmsById,
    awakenersById,
  };
}

export async function buildAllMothertreeGearPacks(
  kinds: GearAuditKind[] = ["posse", "wheel", "covenant"],
  supabase?: SupabaseClient<Database>,
): Promise<Record<GearAuditKind, MothertreeGearPack>> {
  const client = supabase ?? createScriptClient();
  const entries = await Promise.all(
    kinds.map(
      async (kind) => [kind, await buildMothertreeGearPack(kind, client)] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<GearAuditKind, MothertreeGearPack>;
}
