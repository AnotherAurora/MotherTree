/**
 * SKeyDB description-arg resolution for kit pack export.
 * Aligns token grammar with dansa/SKeyDB description-token-grammar.ts.
 */

import type { AllStats } from "@/lib/team-data/types";

/** SKeyDB arg key: Arg1, StateArg1, DescArg1, or custom identifier. */
export const DESCRIPTION_ARG_KEY_PATTERN =
  String.raw`(?:StateArg|DescArg|Arg)\d+|[A-Za-z][A-Za-z0-9_]*`;

/** Channel token: [Damage:Arg1], [Power:Arg1], [{Poison}:Arg3], [Arg1]. */
export const DESCRIPTION_ARG_TOKEN_RE = new RegExp(
  String.raw`\[(?:(?:[A-Za-z]+|\{[^}\]]+\}):)?(${DESCRIPTION_ARG_KEY_PATTERN})\]`,
  "g",
);

/** Plural macro with optional channel prefix on inner token. */
const PLURAL_MACRO_RE = new RegExp(
  String.raw`\{plural:\[(?:(?:[A-Za-z]+|\{[^}\]]+\}):)?(${DESCRIPTION_ARG_KEY_PATTERN})\]\|([^|{}]+)\|([^{}]+)\}`,
  "g",
);

export type DescriptionArgSubstatBonus = {
  substat: string;
  multiplier: string;
  mode?: string;
  suffix?: string;
  baseMultiplier?: string;
};

export type KitDescriptionArg =
  | {
      kind: "linear";
      base: string;
      gainPerLevel: string;
      stat?: string;
      suffix?: string;
      substatBonus?: DescriptionArgSubstatBonus;
    }
  | {
      kind: "scaling";
      values: string[];
      stat?: string;
      suffix?: string;
      substatBonus?: DescriptionArgSubstatBonus;
    }
  | {
      kind: "fixed";
      value: string;
      stat?: string;
      suffix?: string;
      substatBonus?: DescriptionArgSubstatBonus;
    };

export type ResolvedArgMetaEntry = {
  /** MotherTree all_stats when SKeyDB stat is ATK/DEF/CON. */
  stat: AllStats | null;
  suffix: string | null;
  hasSubstatBonus: boolean;
  /** MotherTree all_stats when substatBonus.substat maps (e.g. SigilYield → sigil_yield). */
  substatBonusSubstat: AllStats | null;
};

function parseNumeric(raw: string | undefined): number {
  if (!raw) return 0;
  const parsed = Number(String(raw).trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferSuffix(arg: KitDescriptionArg): string | null {
  if ("suffix" in arg && arg.suffix != null && String(arg.suffix).trim() !== "") {
    return String(arg.suffix);
  }
  const bonus =
    "substatBonus" in arg ? arg.substatBonus?.suffix : undefined;
  return bonus != null && String(bonus).trim() !== "" ? String(bonus) : null;
}

function inferStat(arg: KitDescriptionArg): string | null {
  if ("stat" in arg && arg.stat != null && String(arg.stat).trim() !== "") {
    return String(arg.stat).trim();
  }
  const suffix = inferSuffix(arg);
  if (suffix) {
    const match = /\{(ATK|DEF|CON)\}/.exec(suffix);
    if (match) return match[1];
  }
  return null;
}

/** Map SKeyDB stat label → MotherTree all_stats (linear deps only). */
export function skeydbStatToDependencyStat(
  stat: string | null | undefined,
): AllStats | null {
  if (!stat) return null;
  switch (stat.trim().toUpperCase()) {
    case "ATK":
      return "atk";
    case "DEF":
      return "def";
    case "CON":
      return "con";
    case "SIGILYIELD":
    case "SIGIL_YIELD":
      return "sigil_yield";
    default:
      return null;
  }
}

/** Map SKeyDB substatBonus.substat → MotherTree all_stats when known. */
export function skeydbSubstatToDependencyStat(
  substat: string | null | undefined,
): AllStats | null {
  if (!substat) return null;
  const normalized = substat.replace(/([a-z])([A-Z])/g, "$1_$2");
  return skeydbStatToDependencyStat(normalized.replace(/_/g, ""));
}

export function resolveArgValue(
  arg: KitDescriptionArg | undefined,
  level: number,
): string | number {
  if (!arg) return "";
  if (arg.kind === "linear") {
    const rank = Math.max(1, Math.floor(level));
    return (
      parseNumeric(arg.base) + parseNumeric(arg.gainPerLevel) * (rank - 1)
    );
  }
  if (arg.kind === "scaling") {
    const values = arg.values ?? [];
    const index = Math.max(
      0,
      Math.min(Math.floor(level) - 1, values.length - 1),
    );
    const n = parseNumeric(values[index]);
    return Number.isFinite(n) ? n : (values[index] ?? "");
  }
  if (arg.kind === "fixed") {
    const n = Number(arg.value);
    return Number.isFinite(n) && String(n) === String(arg.value).trim()
      ? n
      : (arg.value ?? "");
  }
  return "";
}

export function buildResolvedArgMeta(
  args: Record<string, KitDescriptionArg> | undefined,
): Record<string, ResolvedArgMetaEntry> {
  const meta: Record<string, ResolvedArgMetaEntry> = {};
  for (const [key, arg] of Object.entries(args ?? {})) {
    const suffix = inferSuffix(arg);
    const skeydbStat = inferStat(arg);
    const substatBonus =
      "substatBonus" in arg ? arg.substatBonus : undefined;
    meta[key] = {
      stat: skeydbStatToDependencyStat(skeydbStat),
      suffix,
      hasSubstatBonus: substatBonus != null,
      substatBonusSubstat: skeydbSubstatToDependencyStat(substatBonus?.substat),
    };
  }
  return meta;
}

/** Kit percent arg → MotherTree value_scalar (4% → 0.04). */
export function valueScalarFromKitPercent(resolvedValue: number): number {
  return resolvedValue / 100;
}

/** Infer dependency_stat when arg scales as N% of a base stat. */
export function inferDependencyStatFromArgMeta(
  meta: ResolvedArgMetaEntry | null | undefined,
): AllStats | null {
  if (!meta?.stat || !meta.suffix?.includes("%")) return null;
  return meta.stat;
}

/** Multi-stat substatBonus formulas cannot be one ATM — fail closed. */
export function argMetaRequiresReview(
  meta: ResolvedArgMetaEntry | null | undefined,
): boolean {
  return meta?.hasSubstatBonus === true;
}

export function expandDescriptionTemplate(
  template: string,
  args: Record<string, KitDescriptionArg> | undefined,
  level: number,
): {
  text: string;
  resolvedArgs: Record<string, string | number>;
  resolvedArgMeta: Record<string, ResolvedArgMetaEntry>;
} {
  const resolvedArgs: Record<string, string | number> = {};
  for (const [key, arg] of Object.entries(args ?? {})) {
    resolvedArgs[key] = resolveArgValue(arg, level);
  }
  const resolvedArgMeta = buildResolvedArgMeta(args);

  let text = template ?? "";

  // Plural macros before token substitution (inner token still [Channel:ArgKey]).
  text = text.replace(
    PLURAL_MACRO_RE,
    (_m, key: string, singular: string, plural: string) => {
      const n = Number(resolvedArgs[key]);
      return n === 1 ? singular : plural;
    },
  );

  text = text.replace(DESCRIPTION_ARG_TOKEN_RE, (_m, key: string) => {
    const v = resolvedArgs[key];
    return v == null || v === "" ? `[${key}]` : String(v);
  });

  return { text, resolvedArgs, resolvedArgMeta };
}
