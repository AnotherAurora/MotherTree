export type CalculatorGroup = "core" | "realms" | "covenant";

export type CalculatorPageHeading = "visible" | "sr-only";

export type CalculatorEntry = {
  slug: string;
  title: string;
  group: CalculatorGroup;
  description: string;
  relatedSlugs: readonly string[];
  /** Core tools: visible page h1. Realm tools: sr-only h1 (component owns visual title). */
  pageHeading: CalculatorPageHeading;
  /** Manual showcase deep-link shown in the Related footer. */
  manualHref?: string;
};

export const CALCULATOR_GROUPS: readonly {
  id: CalculatorGroup;
  label: string;
  hubBlurb: string;
}[] = [
  {
    id: "core",
    label: "Core Mechanics",
    hubBlurb:
      "Keyflare, Aliemus, Death Resist, Team Max HP, and Keyflare Harmony.",
  },
  {
    id: "realms",
    label: "Realms",
    hubBlurb: "Chaos, Aequor, Caro, and Ultra Realm calculators.",
  },
  {
    id: "covenant",
    label: "Covenant",
    hubBlurb: "Main Stat and Sub Stat",
  },
] as const;

export const CALCULATOR_CATALOG: readonly CalculatorEntry[] = [
  {
    slug: "keyflare",
    title: "Keyflare",
    group: "core",
    description:
      "Diminishing-return Keyflare from raw sources, plus the amount needed for the next breakpoint.",
    relatedSlugs: ["keyflare-harmony"],
    pageHeading: "visible",
    manualHref: "/manual/calculators#showcase-keyflare-aliemus",
  },
  {
    slug: "keyflare-harmony",
    title: "Keyflare Harmony",
    group: "core",
    description:
      "Team Keyflare regen per turn and exalt penalty from Awakener Keyflare Harmony slots.",
    relatedSlugs: ["keyflare"],
    pageHeading: "visible",
    manualHref: "/manual/calculators#showcase-keyflare-harmony",
  },
  {
    slug: "aliemus",
    title: "Aliemus",
    group: "core",
    description:
      "Diminishing-return Aliemus from raw sources, plus the amount needed for the next breakpoint.",
    relatedSlugs: [],
    pageHeading: "visible",
    manualHref: "/manual/calculators#showcase-keyflare-aliemus",
  },
  {
    slug: "death-resist",
    title: "Death Resist",
    group: "core",
    description:
      "In-mission Death Resist from raw values, Primordia Chaos, and Chaos Awakener presence.",
    relatedSlugs: ["team-max-hp"],
    pageHeading: "visible",
    manualHref: "/manual/calculators#showcase-death-resist",
  },
  {
    slug: "team-max-hp",
    title: "Team Max HP",
    group: "core",
    description:
      "Team Max HP from constitution slots, Awakener levels, and Death Resist context.",
    relatedSlugs: ["death-resist", "caro-realm", "aequor-realm", "ultra-realm"],
    pageHeading: "visible",
    manualHref: "/manual/calculators#showcase-team-max-hp",
  },
  {
    slug: "chaos-realm",
    title: "Chaos Realm",
    group: "realms",
    description:
      "Aliemus per Posse from Realm Mastery for Chaos Realm (RTM 3 + 37).",
    relatedSlugs: [],
    pageHeading: "sr-only",
  },
  {
    slug: "aequor-realm",
    title: "Aequor Realm",
    group: "realms",
    description:
      "Aequor / Benthos Aequor Realm stats including tentacle damage and attack bonuses.",
    relatedSlugs: ["team-max-hp"],
    pageHeading: "sr-only",
  },
  {
    slug: "caro-realm",
    title: "Caro Realm",
    group: "realms",
    description:
      "Caro / Propagation Caro Realm effects from Team Max HP, current HP, and Realm Mastery.",
    relatedSlugs: ["team-max-hp"],
    pageHeading: "sr-only",
  },
  {
    slug: "ultra-realm",
    title: "Ultra Realm",
    group: "realms",
    description:
      "Ultra / Singularity Ultra Realm crit and insight chance from Realm Mastery and Chaos context.",
    relatedSlugs: ["team-max-hp"],
    pageHeading: "sr-only",
  },
] as const;

export type CalculatorSlug = (typeof CALCULATOR_CATALOG)[number]["slug"];

const bySlug = new Map(
  CALCULATOR_CATALOG.map((entry) => [entry.slug, entry] as const),
);

export function getCalculatorBySlug(slug: string): CalculatorEntry | undefined {
  return bySlug.get(slug);
}

export function isCalculatorSlug(slug: string): slug is CalculatorSlug {
  return bySlug.has(slug);
}

export function isCalculatorGroup(value: string): value is CalculatorGroup {
  return value === "core" || value === "realms" || value === "covenant";
}

export function getCalculatorsByGroup(
  group: CalculatorGroup,
): readonly CalculatorEntry[] {
  return CALCULATOR_CATALOG.filter((entry) => entry.group === group);
}

export function getDefaultCalculatorForGroup(
  group: CalculatorGroup,
): CalculatorEntry {
  const first = getCalculatorsByGroup(group)[0];
  if (!first) {
    throw new Error(`No calculators registered for group: ${group}`);
  }
  return first;
}

export function getGroupLabel(group: CalculatorGroup): string {
  const match = CALCULATOR_GROUPS.find((entry) => entry.id === group);
  return match?.label ?? group;
}

export function getGroupHref(group: CalculatorGroup): string {
  return `/calculators/${group}`;
}

export function getCalculatorHref(entry: CalculatorEntry): string {
  return `/calculators/${entry.group}/${entry.slug}`;
}

export function getRelatedCalculators(
  entry: CalculatorEntry,
): readonly CalculatorEntry[] {
  return entry.relatedSlugs
    .map((slug) => bySlug.get(slug))
    .filter((related): related is CalculatorEntry => related !== undefined);
}

/** Flat `/calculators/:slug` → nested `/calculators/:group/:slug` (for next.config). */
export function getFlatSlugRedirects(): readonly {
  source: string;
  destination: string;
  permanent: true;
}[] {
  return CALCULATOR_CATALOG.map((entry) => ({
    source: `/calculators/${entry.slug}`,
    destination: getCalculatorHref(entry),
    permanent: true as const,
  }));
}
