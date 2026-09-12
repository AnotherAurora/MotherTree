import { REQUIRED_BASE_STAT_TAG_IDS } from "@/lib/path-carver/awakener-base-stats";
import {
  SPECIAL_ALL_TENTACLE_ATTACK_TAG_ID,
  SUPPORT_GENERATE_PERMANENT_TENTACLE_TAG_ID,
  SUPPORT_GENERATE_TEMPORARY_TENTACLE_TAG_ID,
} from "@/lib/path-carver/all-tentacle-attack";
import { REQUIRED_HIT_TENTACLE_TAG_IDS } from "@/lib/path-carver/hit-tentacle-attack";
import {
  SPECIAL_CAUSE_LEMURIAN_TAG_ID,
  SPECIAL_WHEN_LEMURIAN_SYNERGY_1_TAG_ID,
  SPECIAL_WHEN_LEMURIAN_SYNERGY_2_TAG_ID,
  SPECIAL_WHEN_LEMURIAN_SYNERGY_3_TAG_ID,
} from "@/lib/path-carver/lemurian-synergy";
import { DAMAGE_CHANNEL_TAGS } from "@/lib/path-carver/total-damage";
import {
  CAUSE_TO_WHEN,
  SPECIAL_CAUSE_DEVOUR_TAG_ID,
  SPECIAL_CAUSE_RESONANCE_TAG_ID,
  SPECIAL_WHEN_DEATH_RESIST_TRIGGER_TAG_ID,
  SPECIAL_WHEN_DEVOUR_TAG_ID,
  SPECIAL_WHEN_POSSE_TAG_ID,
  SPECIAL_WHEN_RESONANCE_TAG_ID,
} from "@/lib/path-carver/trigger-condition";
import { matchesDemandTag } from "@/lib/simulator/tag-matching";
import type {
  DefaultInteraction,
  Manifestation,
  Tag,
  TeamData,
} from "@/lib/team-data/types";

/**
 * Damage-relevance filter (Relic Picker perf).
 *
 * The engine is a fixpoint over `modifier tag → target tag` edges, and Total
 * Damage reads only the six `DAMAGE_CHANNEL_TAGS` roots. Any tag that cannot
 * reach a channel cannot change the answer, so it can be dropped from
 * `tagsById`, `defaultInteractions`, and `manifestations` before the engine runs.
 *
 * A handful of inputs are produced by code-driven synthetic hops instead of
 * `tag_default_interaction`, so the seed set below must include them explicitly.
 * The list mirrors the `REQUIRED_*_TAG_IDS` constants the engine already treats
 * as mandatory; keep them in sync when a hop gains a new input tag.
 */
export const DAMAGE_SEED_TAG_IDS: readonly number[] = Array.from(
  new Set<number>([
    ...REQUIRED_BASE_STAT_TAG_IDS,
    ...REQUIRED_HIT_TENTACLE_TAG_IDS,
    SPECIAL_ALL_TENTACLE_ATTACK_TAG_ID,
    SUPPORT_GENERATE_TEMPORARY_TENTACLE_TAG_ID,
    SUPPORT_GENERATE_PERMANENT_TENTACLE_TAG_ID,
    SPECIAL_CAUSE_DEVOUR_TAG_ID,
    SPECIAL_WHEN_DEVOUR_TAG_ID,
    SPECIAL_CAUSE_RESONANCE_TAG_ID,
    SPECIAL_WHEN_RESONANCE_TAG_ID,
    SPECIAL_WHEN_DEATH_RESIST_TRIGGER_TAG_ID,
    SPECIAL_WHEN_POSSE_TAG_ID,
    SPECIAL_CAUSE_LEMURIAN_TAG_ID,
    SPECIAL_WHEN_LEMURIAN_SYNERGY_1_TAG_ID,
    SPECIAL_WHEN_LEMURIAN_SYNERGY_2_TAG_ID,
    SPECIAL_WHEN_LEMURIAN_SYNERGY_3_TAG_ID,
    ...[...CAUSE_TO_WHEN.keys()],
    ...[...CAUSE_TO_WHEN.values()],
  ]),
);

export type DamageRelevance = {
  /** Tags that can reach a damage channel, plus the code-driven seeds. */
  tagIds: ReadonlySet<number>;
  /** Only the `tag_default_interaction` rows that can reach a channel. */
  defaultInteractions: DefaultInteraction[];
};

const MAX_CLOSURE_PASSES = 64;

function anyRelevantTagMatches(
  tags: readonly Tag[],
  relevant: ReadonlySet<number>,
  targetTagName: string,
  exclusionTagName: string | null,
): boolean {
  if (!targetTagName) return false;
  for (const tag of tags) {
    if (!relevant.has(tag.id)) continue;
    if (!matchesDemandTag(tag.tagName, targetTagName)) continue;
    if (
      exclusionTagName != null &&
      exclusionTagName !== "" &&
      matchesDemandTag(tag.tagName, exclusionTagName)
    ) {
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Reverse-closure from the six damage channels over interactions, aftereffects,
 * `unique_scaling` locals, trigger gates, and copy providers.
 *
 * Run over the union of the team plus every candidate relic so the resulting
 * tag set is stable across the whole ranking sweep.
 */
export function computeDamageRelevance(input: {
  tagsById: Readonly<Record<number, Tag>>;
  defaultInteractions: readonly DefaultInteraction[];
  manifestations: readonly Manifestation[];
}): DamageRelevance {
  const tags = Object.values(input.tagsById);
  const relevant = new Set<number>();

  // Seed 1: damage channels and all their descendants (rollup matches prefixes).
  for (const tag of tags) {
    for (const channel of DAMAGE_CHANNEL_TAGS) {
      if (matchesDemandTag(tag.tagName, channel)) {
        relevant.add(tag.id);
        break;
      }
    }
  }
  // Seed 2: code-driven synthetic hops (ids may not exist in `tagsById`).
  for (const id of DAMAGE_SEED_TAG_IDS) relevant.add(id);

  let changed = true;
  for (let pass = 0; changed && pass < MAX_CLOSURE_PASSES; pass += 1) {
    changed = false;
    const add = (id: number | null | undefined): void => {
      if (id == null || relevant.has(id)) return;
      relevant.add(id);
      changed = true;
    };

    // tag_default_interaction: target relevant → modifier relevant.
    for (const interaction of input.defaultInteractions) {
      const touchesChannel =
        interaction.createsBase && !interaction.amplifiesSubject
          ? interaction.targetTagId != null &&
            relevant.has(interaction.targetTagId)
          : anyRelevantTagMatches(
              tags,
              relevant,
              interaction.targetTagName,
              interaction.exclusionTagName,
            );
      if (!touchesChannel) continue;
      add(interaction.modifierTagId);
    }

    for (const m of input.manifestations) {
      const tagRelevant = relevant.has(m.tagId);

      // Trigger gate: a relevant row needs its When id and the matching Cause(s).
      if (tagRelevant && m.triggerCondition != null) {
        add(m.triggerCondition);
        for (const [causeId, whenId] of CAUSE_TO_WHEN) {
          if (whenId === m.triggerCondition) add(causeId);
        }
      }

      // Copy providers drive effective copy/hit counts.
      if (tagRelevant) {
        for (const providerTagId of m.copyProviderTagIds) add(providerTagId);
      }

      for (const row of m.interactionOverrides) {
        if (row.isDisabled) continue;
        if (row.mode === "aftereffect") {
          // Source feeds an exact sink; keep the source only when the sink matters.
          if (row.targetTagId != null && relevant.has(row.targetTagId)) {
            add(m.tagId);
            add(row.modifierTagId);
          }
        } else if (row.mode === "unique_scaling") {
          // Incoming modifier scales the parent tag.
          if (tagRelevant) add(row.modifierTagId);
        } else if (tagRelevant) {
          // direct_modifier only rewrites the parent tag.
          add(row.modifierTagId);
        }
      }
    }
  }

  const defaultInteractions = input.defaultInteractions.filter((interaction) =>
    interaction.createsBase && !interaction.amplifiesSubject
      ? interaction.targetTagId != null && relevant.has(interaction.targetTagId)
      : anyRelevantTagMatches(
          tags,
          relevant,
          interaction.targetTagName,
          interaction.exclusionTagName,
        ),
  );

  return { tagIds: relevant, defaultInteractions };
}

/** Keep only damage-relevant manifestations and interactions; tags stay a map. */
export function filterTeamDataToRelevance(
  teamData: TeamData,
  relevance: DamageRelevance,
): TeamData {
  const tagsById: Record<number, Tag> = {};
  for (const [idText, tag] of Object.entries(teamData.tagsById)) {
    const id = Number(idText);
    if (relevance.tagIds.has(id)) tagsById[id] = tag;
  }
  return {
    ...teamData,
    tagsById,
    defaultInteractions: relevance.defaultInteractions,
    manifestations: teamData.manifestations.filter((m) =>
      relevance.tagIds.has(m.tagId),
    ),
  };
}

/** Prefilter relic rows before injecting them into a filtered team. */
export function filterManifestationsToRelevance(
  manifestations: readonly Manifestation[],
  relevance: DamageRelevance,
): Manifestation[] {
  return manifestations.filter((m) => relevance.tagIds.has(m.tagId));
}
