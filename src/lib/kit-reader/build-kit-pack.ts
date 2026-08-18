/**
 * Deterministic SKeyDB → MotherTree kit pack for Kit Reader.
 * Investment assumptions match primary-stats datapatch + skill lv6.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SKEYDB_COMMIT } from "@/lib/assets/skeydb-base";
import { ENUM_VALUES, type Database } from "@/lib/database.types";
import { flavorTagSynonymsForPack } from "./flavor-tag-synonyms";
import {
  formatCostSourceLabel,
  isUsableSkillCost,
} from "./atm-metadata";
import {
  aoeTagPrefixesForPack,
  detectEnjoyClause,
  detectEnjoyTentacleDmgClause,
  enjoyTentacleDmgModifierTagNamesForPack,
} from "./proposal-heuristics";
import { kitPackAbsolutePath, kitPackRelativePath } from "./paths";

const RAW_BASE = `https://raw.githubusercontent.com/dansa/SKeyDB/${SKEYDB_COMMIT}`;
const AWAKENER_LEVEL = 60;
const TARGET_SOULFORGE_LEVEL = 10;
const SKILL_LEVEL = 6;

export type MotherTreeSourceType =
  | "command card"
  | "exalt"
  | "tentacle"
  | "rouse"
  | "talent";

type DescriptionArg =
  | { kind: "linear"; base: string; gainPerLevel: string }
  | { kind: "scaling"; values: string[]; stat?: string; suffix?: string }
  | { kind: "fixed"; value: string }
  | { kind: string; [key: string]: unknown };

type SkillUpgrade = {
  id?: string;
  operation?: string;
  upgraderId?: string;
  upgraderType?: string;
  upgraderSlot?: string;
  patch?: {
    descriptionTemplate?: string;
    descriptionArgs?: Record<string, DescriptionArg>;
  };
};

type SkillRecord = {
  id: string;
  name: string;
  slot?: string;
  cost?: string | number | null;
  descriptionTemplate?: string;
  descriptionArgs?: Record<string, DescriptionArg>;
  upgrades?: SkillUpgrade[];
  derived?: boolean;
  isDerived?: boolean;
  route?: { slug?: string };
};

type TalentRecord = {
  id: string;
  name: string;
  family?: string;
  maxLevel?: number;
  defaultMaxed?: boolean;
  descriptionTemplate?: string;
  descriptionArgs?: Record<string, DescriptionArg>;
  route?: { slug?: string };
};

type CatalogAwakener = {
  id: string;
  name: string;
  route: { slug: string };
};

type CatalogFile = { records: CatalogAwakener[] };

type RelationshipsForward = {
  ownedSkills?: string[];
  ownedTalents?: string[];
  ownedDerivedSkills?: string[];
  ownedDerivedCards?: string[];
  derivedSkills?: string[];
};

type RelationshipsIndex = {
  forward: Record<string, RelationshipsForward>;
};

export type ExpandedLayer = {
  layerKind: "base" | "enlighten" | "talent" | "soulforge";
  upgraderType?: string | null;
  upgraderSlot?: string | null;
  upgraderId?: string | null;
  operation?: string | null;
  /** Metadata source prefix for this layer (AA overrides parent for AbsoluteAxiom). */
  sourceLabelHint: string;
  requiredEnlightenmentHint: number;
  descriptionTemplate: string;
  expandedText: string;
  resolvedArgs: Record<string, string | number>;
  /** Kit text contains enjoy/enjoys/enjoying — inspect for unique_scaling locals. */
  hasEnjoyClause: boolean;
  /** Enjoy clause is followed by Tentacle DMG / Tentacle Damage — dual TDU locals. */
  hasEnjoyTentacleDmgClause: boolean;
};

export type KitPackSkill = {
  id: string;
  name: string;
  slot: string | null;
  /** Raw SKeyDB cost string when present. */
  cost: string | null;
  /** ATM metadata source prefix (Exalt / OE / Rouse / Strike / 0 Cost / …). */
  sourceLabel: string;
  sourceTypeHint: MotherTreeSourceType;
  defaultRequiredEnlightenment: number;
  atmEligible: boolean;
  base: ExpandedLayer;
  upgrades: ExpandedLayer[];
};

export type KitPackTalent = {
  id: string;
  name: string;
  family: string | null;
  sourceTypeHint: "talent";
  /** Talent or SF for metadata. */
  sourceLabel: "Talent" | "SF";
  atmEligible: boolean;
  soulforgeIgnoreBoilerplate: boolean;
  levelUsed: number;
  maxLevel: number | null;
  base: ExpandedLayer;
};

export type KitPack = {
  assumptions: {
    level: number;
    soulforge: number;
    gnostic: number;
    skillLevel: number;
    limitedGnosticLv5: boolean;
  };
  awakener: {
    motherTreeId: number;
    name: string;
    skeydbId: string;
    slug: string;
    skeydbCommit: string;
  };
  skills: KitPackSkill[];
  derivedCards: KitPackSkill[];
  talents: KitPackTalent[];
  ignoreList: string[];
  lexicon: {
    tags: { id: number; tag_name: string }[];
    realms: { id: number; name: string }[];
    copyProviderGroups: { id: number; name: string }[];
    enums: {
      source_type: readonly string[];
      target_type: readonly string[];
      all_stats: readonly string[];
      layer: readonly string[];
      operation_type: readonly string[];
    };
    flavorTagSynonyms: ReturnType<typeof flavorTagSynonymsForPack>;
    aoeTagPrefixes: string[];
    enjoyTentacleDmgModifierTagNames: string[];
  };
};

const IGNORE_LIST = [
  "gnostic_potential",
  "madness_omen",
  "dimensional_image",
  "soulforge_boilerplate",
] as const;

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as T;
}

function parseNumeric(raw: string | undefined): number {
  if (!raw) return 0;
  const parsed = Number(String(raw).trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveArgValue(
  arg: DescriptionArg | undefined,
  level: number,
): string | number {
  if (!arg) return "";
  if (arg.kind === "linear") {
    const linear = arg as { base: string; gainPerLevel: string };
    const rank = Math.max(1, Math.floor(level));
    return (
      parseNumeric(linear.base) +
      parseNumeric(linear.gainPerLevel) * (rank - 1)
    );
  }
  if (arg.kind === "scaling") {
    const values = (arg as { values: string[] }).values ?? [];
    const index = Math.max(
      0,
      Math.min(Math.floor(level) - 1, values.length - 1),
    );
    const n = parseNumeric(values[index]);
    return Number.isFinite(n) ? n : (values[index] ?? "");
  }
  if (arg.kind === "fixed") {
    const value = (arg as { value: string }).value;
    const n = Number(value);
    return Number.isFinite(n) && String(n) === String(value).trim()
      ? n
      : (value ?? "");
  }
  return "";
}

function expandTemplate(
  template: string,
  args: Record<string, DescriptionArg> | undefined,
  level: number,
): { text: string; resolvedArgs: Record<string, string | number> } {
  const resolvedArgs: Record<string, string | number> = {};
  for (const [key, arg] of Object.entries(args ?? {})) {
    resolvedArgs[key] = resolveArgValue(arg, level);
  }

  let text = template ?? "";
  // [Damage:Arg1], [Arg1], {plural:[Arg2]|time|times}, {Brace}
  text = text.replace(/\[(?:Damage:)?([A-Za-z0-9_]+)\]/g, (_m, key: string) => {
    const v = resolvedArgs[key];
    return v == null ? `[${key}]` : String(v);
  });
  text = text.replace(
    /\{plural:\[([A-Za-z0-9_]+)\]\|([^|]+)\|([^}]+)\}/g,
    (_m, key: string, singular: string, plural: string) => {
      const n = Number(resolvedArgs[key]);
      return n === 1 ? singular : plural;
    },
  );

  return { text, resolvedArgs };
}

function layerFromExpanded(
  partial: Omit<
    ExpandedLayer,
    "hasEnjoyClause" | "hasEnjoyTentacleDmgClause"
  >,
  expandedText: string,
): ExpandedLayer {
  return {
    ...partial,
    hasEnjoyClause: detectEnjoyClause(expandedText),
    hasEnjoyTentacleDmgClause: detectEnjoyTentacleDmgClause(expandedText),
  };
}

/** Slot → MotherTree source_type (+ OE enlightenment default). */
export function sourceTypeFromSlot(slot: string | null | undefined): {
  sourceTypeHint: MotherTreeSourceType;
  defaultRequiredEnlightenment: number;
} {
  switch (slot) {
    case "Strike":
    case "Defense":
    case "Skill1":
    case "Skill2":
      return { sourceTypeHint: "command card", defaultRequiredEnlightenment: 0 };
    case "Rouse":
      return { sourceTypeHint: "rouse", defaultRequiredEnlightenment: 0 };
    case "Exalt":
      return { sourceTypeHint: "exalt", defaultRequiredEnlightenment: 0 };
    case "OverExalt":
      return { sourceTypeHint: "exalt", defaultRequiredEnlightenment: 7 };
    default:
      return { sourceTypeHint: "command card", defaultRequiredEnlightenment: 0 };
  }
}

function enlightenSlotToRequired(slot: string | null | undefined): number {
  if (slot === "E1") return 1;
  if (slot === "E2") return 2;
  if (slot === "E3") return 3;
  if (slot === "AbsoluteAxiom") return 15;
  return 0;
}

function normalizeSkillCost(cost: string | number | null | undefined): string | null {
  if (cost == null) return null;
  const trimmed = String(cost).trim();
  return trimmed === "" ? null : trimmed;
}

function usesCostBasedSourceLabel(slot: string | null): boolean {
  return (
    slot === "Skill1" ||
    slot === "Skill2" ||
    slot == null ||
    (slot !== "Strike" &&
      slot !== "Defense" &&
      slot !== "Rouse" &&
      slot !== "Exalt" &&
      slot !== "OverExalt")
  );
}

/**
 * Fixed source labels from slot; cost-based labels assigned later after
 * uniqueness check across Skill1/Skill2/derived.
 */
function sourceLabelFromSlot(
  slot: string | null,
  name: string,
): string | null {
  switch (slot) {
    case "Exalt":
      return "Exalt";
    case "OverExalt":
      return "OE";
    case "Rouse":
      return "Rouse";
    case "Strike":
    case "Defense":
      return name;
    default:
      return null;
  }
}

function layerSourceLabelHint(
  parentSourceLabel: string,
  upgraderSlot: string | null | undefined,
): string {
  if (upgraderSlot === "AbsoluteAxiom") return "AA";
  return parentSourceLabel;
}

function assignCostBasedSourceLabels(skills: KitPackSkill[]): void {
  const costCandidates = skills.filter((s) =>
    usesCostBasedSourceLabel(s.slot),
  );

  const costCounts = new Map<string, number>();
  for (const skill of costCandidates) {
    if (!isUsableSkillCost(skill.cost)) continue;
    const key = String(skill.cost).trim();
    costCounts.set(key, (costCounts.get(key) ?? 0) + 1);
  }

  for (const skill of costCandidates) {
    const cost = skill.cost;
    const unique =
      isUsableSkillCost(cost) &&
      (costCounts.get(String(cost).trim()) ?? 0) === 1;
    skill.sourceLabel = unique
      ? formatCostSourceLabel(String(cost).trim())
      : skill.name;

    skill.base.sourceLabelHint = skill.sourceLabel;
    skill.upgrades = skill.upgrades.map((upgrade) => ({
      ...upgrade,
      sourceLabelHint: layerSourceLabelHint(
        skill.sourceLabel,
        upgrade.upgraderSlot,
      ),
    }));
  }
}

function talentAtmEligibility(talent: TalentRecord): {
  atmEligible: boolean;
  soulforgeIgnoreBoilerplate: boolean;
  ignoreKey: string | null;
} {
  const family = (talent.family ?? "").toLowerCase();
  const name = (talent.name ?? "").toLowerCase();
  const id = (talent.id ?? "").toLowerCase();

  if (
    family.includes("gnostic") ||
    name.includes("gnostic potential") ||
    id.includes("gnostic-potential")
  ) {
    return {
      atmEligible: false,
      soulforgeIgnoreBoilerplate: false,
      ignoreKey: "gnostic_potential",
    };
  }
  if (
    family.includes("madness") ||
    name.includes("madness omen") ||
    id.includes("madness-omen")
  ) {
    return {
      atmEligible: false,
      soulforgeIgnoreBoilerplate: false,
      ignoreKey: "madness_omen",
    };
  }
  if (
    name.includes("dimensional image") ||
    id.includes("dimensional-image") ||
    family.includes("dimensional")
  ) {
    return {
      atmEligible: false,
      soulforgeIgnoreBoilerplate: false,
      ignoreKey: "dimensional_image",
    };
  }
  if (
    family.includes("soulforge") ||
    name.includes("soulforge aptitude") ||
    id.includes("soulforge-aptitude")
  ) {
    return {
      atmEligible: true,
      soulforgeIgnoreBoilerplate: true,
      ignoreKey: "soulforge_boilerplate",
    };
  }
  return {
    atmEligible: true,
    soulforgeIgnoreBoilerplate: false,
    ignoreKey: null,
  };
}

function buildSkillPackEntry(
  skill: SkillRecord,
  skillLevel: number,
  opts?: { forceDerived?: boolean },
): KitPackSkill {
  const slot = skill.slot ?? null;
  const cost = normalizeSkillCost(skill.cost);
  const { sourceTypeHint, defaultRequiredEnlightenment } =
    sourceTypeFromSlot(slot);
  // Placeholder for cost-based slots; assignCostBasedSourceLabels overwrites.
  const initialSourceLabel =
    sourceLabelFromSlot(slot, skill.name) ?? skill.name;
  const baseTemplate = skill.descriptionTemplate ?? "";
  const baseExpanded = expandTemplate(
    baseTemplate,
    skill.descriptionArgs,
    skillLevel,
  );

  const upgrades: ExpandedLayer[] = (skill.upgrades ?? []).map((upgrade) => {
    const patchTemplate =
      upgrade.patch?.descriptionTemplate ?? baseTemplate;
    const patchArgs =
      upgrade.patch?.descriptionArgs ?? skill.descriptionArgs;
    const expanded = expandTemplate(patchTemplate, patchArgs, skillLevel);
    const upgraderType = upgrade.upgraderType ?? null;
    const upgraderSlot = upgrade.upgraderSlot ?? null;
    let requiredEnlightenmentHint = defaultRequiredEnlightenment;
    let layerKind: ExpandedLayer["layerKind"] = "base";
    if (upgraderType === "enlighten") {
      layerKind = "enlighten";
      requiredEnlightenmentHint = enlightenSlotToRequired(upgraderSlot);
    } else if (upgraderType === "talent") {
      layerKind = "talent";
    }
    return layerFromExpanded(
      {
        layerKind,
        upgraderType,
        upgraderSlot,
        upgraderId: upgrade.upgraderId ?? null,
        operation: upgrade.operation ?? null,
        sourceLabelHint: layerSourceLabelHint(initialSourceLabel, upgraderSlot),
        requiredEnlightenmentHint,
        descriptionTemplate: patchTemplate,
        expandedText: expanded.text,
        resolvedArgs: expanded.resolvedArgs,
      },
      expanded.text,
    );
  });

  void opts;

  return {
    id: skill.id,
    name: skill.name,
    slot,
    cost,
    sourceLabel: initialSourceLabel,
    sourceTypeHint:
      opts?.forceDerived === true ? "command card" : sourceTypeHint,
    defaultRequiredEnlightenment,
    atmEligible: true,
    base: layerFromExpanded(
      {
        layerKind: "base",
        upgraderType: null,
        upgraderSlot: null,
        upgraderId: null,
        operation: null,
        sourceLabelHint: initialSourceLabel,
        requiredEnlightenmentHint: defaultRequiredEnlightenment,
        descriptionTemplate: baseTemplate,
        expandedText: baseExpanded.text,
        resolvedArgs: baseExpanded.resolvedArgs,
      },
      baseExpanded.text,
    ),
    upgrades,
  };
}

async function loadSkill(skillId: string): Promise<SkillRecord | null> {
  return fetchJson<SkillRecord>(
    `${RAW_BASE}/src/data/public-v3/records/skills/${skillId}.json`,
  );
}

async function loadTalent(talentId: string): Promise<TalentRecord | null> {
  return fetchJson<TalentRecord>(
    `${RAW_BASE}/src/data/public-v3/records/talents/${talentId}.json`,
  );
}

export async function buildKitPackForAwakener(
  supabase: SupabaseClient<Database>,
  motherTreeAwakenerId: number,
): Promise<{ pack: KitPack; relativePath: string; slug: string }> {
  const { data: awakener, error: awakenerError } = await supabase
    .from("awakener")
    .select("id, name")
    .eq("id", motherTreeAwakenerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (awakenerError) {
    throw new Error(`Failed to load awakener: ${awakenerError.message}`);
  }
  if (!awakener) {
    throw new Error(`Awakener id ${motherTreeAwakenerId} not found`);
  }

  const [catalog, relationships, tagsRes, realmsRes, groupsRes] =
    await Promise.all([
      fetchJson<CatalogFile>(
        `${RAW_BASE}/src/data/public-v3/catalogs/awakeners.json`,
      ),
      fetchJson<RelationshipsIndex>(
        `${RAW_BASE}/src/data/public-v3/indexes/relationships.json`,
      ),
      supabase
        .from("tag")
        .select("id, tag_name")
        .is("deleted_at", null)
        .order("tag_name"),
      supabase
        .from("realm")
        .select("id, name")
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("copy_provider_group")
        .select("id, name")
        .is("deleted_at", null)
        .order("name"),
    ]);

  if (!catalog) throw new Error("Failed to load SKeyDB awakeners catalog");
  if (!relationships) {
    throw new Error("Failed to load SKeyDB relationships index");
  }
  if (tagsRes.error) throw new Error(tagsRes.error.message);
  if (realmsRes.error) throw new Error(realmsRes.error.message);
  if (groupsRes.error) throw new Error(groupsRes.error.message);

  const catalogAwakener = catalog.records.find(
    (row) => row.name === awakener.name,
  );
  if (!catalogAwakener) {
    throw new Error(
      `No SKeyDB catalog awakener matching name "${awakener.name}"`,
    );
  }

  const forward = relationships.forward[catalogAwakener.id] ?? {};
  const skillIds = forward.ownedSkills ?? [];
  const derivedIds = [
    ...(forward.ownedDerivedSkills ?? []),
    ...(forward.ownedDerivedCards ?? []),
    ...(forward.derivedSkills ?? []),
  ];
  const talentIds = forward.ownedTalents ?? [];

  const skillRecords = (
    await Promise.all(skillIds.map((id) => loadSkill(id)))
  ).filter((row): row is SkillRecord => row != null);

  const derivedRecords = (
    await Promise.all(derivedIds.map((id) => loadSkill(id)))
  ).filter((row): row is SkillRecord => row != null);

  // Skills flagged derived in the ownedSkills list also go to derivedCards.
  const ownedDerivedFromFlag = skillRecords.filter(
    (s) => s.derived === true || s.isDerived === true,
  );
  const primarySkills = skillRecords.filter(
    (s) => s.derived !== true && s.isDerived !== true,
  );

  const talentRecords = (
    await Promise.all(talentIds.map((id) => loadTalent(id)))
  ).filter((row): row is TalentRecord => row != null);

  const gnostic = talentRecords.find(
    (t) =>
      (t.family ?? "").toLowerCase().includes("gnostic") ||
      (t.id ?? "").includes("gnostic-potential"),
  );
  const soulforge = talentRecords.find(
    (t) =>
      (t.family ?? "").toLowerCase().includes("soulforge") ||
      (t.id ?? "").includes("soulforge-aptitude"),
  );

  const limitedGnosticLv5 = Boolean(gnostic?.defaultMaxed);
  const gnosticLevel = limitedGnosticLv5 ? 5 : 0;
  const soulforgeMax = soulforge?.maxLevel ?? 0;
  const soulforgeLevel = soulforge
    ? Math.min(TARGET_SOULFORGE_LEVEL, soulforgeMax || TARGET_SOULFORGE_LEVEL)
    : 0;

  const skills = primarySkills.map((s) =>
    buildSkillPackEntry(s, SKILL_LEVEL),
  );
  const derivedCards = [...derivedRecords, ...ownedDerivedFromFlag].map((s) =>
    buildSkillPackEntry(s, SKILL_LEVEL, { forceDerived: true }),
  );

  // Cost uniqueness across Skill1/Skill2 + derived (Strike/Defense keep names).
  assignCostBasedSourceLabels([...skills, ...derivedCards]);

  const talents: KitPackTalent[] = talentRecords.map((talent) => {
    const eligibility = talentAtmEligibility(talent);
    const isSoulforge = eligibility.soulforgeIgnoreBoilerplate;
    const sourceLabel: "Talent" | "SF" = isSoulforge ? "SF" : "Talent";
    const levelUsed = isSoulforge
      ? soulforgeLevel
      : (talent.family ?? "").toLowerCase().includes("gnostic")
        ? gnosticLevel
        : (talent.maxLevel ?? 1);
    const expanded = expandTemplate(
      talent.descriptionTemplate ?? "",
      talent.descriptionArgs,
      Math.max(1, levelUsed),
    );
    return {
      id: talent.id,
      name: talent.name,
      family: talent.family ?? null,
      sourceTypeHint: "talent",
      sourceLabel,
      atmEligible: eligibility.atmEligible,
      soulforgeIgnoreBoilerplate: eligibility.soulforgeIgnoreBoilerplate,
      levelUsed,
      maxLevel: talent.maxLevel ?? null,
      base: layerFromExpanded(
        {
          layerKind: isSoulforge ? "soulforge" : "talent",
          upgraderType: null,
          upgraderSlot: null,
          upgraderId: null,
          operation: null,
          sourceLabelHint: sourceLabel,
          requiredEnlightenmentHint: 0,
          descriptionTemplate: talent.descriptionTemplate ?? "",
          expandedText: expanded.text,
          resolvedArgs: expanded.resolvedArgs,
        },
        expanded.text,
      ),
    };
  });

  const pack: KitPack = {
    assumptions: {
      level: AWAKENER_LEVEL,
      soulforge: soulforgeLevel,
      gnostic: gnosticLevel,
      skillLevel: SKILL_LEVEL,
      limitedGnosticLv5,
    },
    awakener: {
      motherTreeId: Number(awakener.id),
      name: String(awakener.name ?? ""),
      skeydbId: catalogAwakener.id,
      slug: catalogAwakener.route.slug,
      skeydbCommit: SKEYDB_COMMIT,
    },
    skills,
    derivedCards,
    talents,
    ignoreList: [...IGNORE_LIST],
    lexicon: {
      tags: (tagsRes.data ?? []) as { id: number; tag_name: string }[],
      realms: (realmsRes.data ?? []) as { id: number; name: string }[],
      copyProviderGroups: (groupsRes.data ?? []) as {
        id: number;
        name: string;
      }[],
      enums: {
        source_type: ENUM_VALUES.source_type,
        target_type: ENUM_VALUES.target_type,
        all_stats: ENUM_VALUES.all_stats,
        layer: ENUM_VALUES.layer,
        operation_type: ENUM_VALUES.operation_type,
      },
      flavorTagSynonyms: flavorTagSynonymsForPack(),
      aoeTagPrefixes: aoeTagPrefixesForPack(),
      enjoyTentacleDmgModifierTagNames:
        enjoyTentacleDmgModifierTagNamesForPack(),
    },
  };

  const slug = catalogAwakener.route.slug;
  return {
    pack,
    slug,
    relativePath: kitPackRelativePath(slug),
  };
}

export function writeKitPackToRepo(
  repoRoot: string,
  slug: string,
  pack: KitPack,
): { absolutePath: string; relativePath: string } {
  const absolutePath = kitPackAbsolutePath(repoRoot, slug);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  return { absolutePath, relativePath: kitPackRelativePath(slug) };
}
