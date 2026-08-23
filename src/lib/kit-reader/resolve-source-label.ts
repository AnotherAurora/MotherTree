/**
 * Kit pack sourceLabel lookup for insert-kit-pending metadata resolution.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { KitPack, KitPackSkill } from "./build-kit-pack";

function indexSkill(skill: KitPackSkill, index: Map<string, string>): void {
  index.set(skill.id, skill.sourceLabel);
  for (const upgrade of skill.upgrades) {
    if (upgrade.upgraderId != null) {
      index.set(upgrade.upgraderId, upgrade.sourceLabelHint);
    }
  }
}

/** Build sourceKitId → sourceLabel / sourceLabelHint index from an exported kit pack. */
export function buildKitPackSourceLabelIndex(pack: KitPack): Map<string, string> {
  const index = new Map<string, string>();

  for (const skill of pack.skills) {
    indexSkill(skill, index);
  }
  for (const derived of pack.derivedCards) {
    indexSkill(derived, index);
  }
  for (const talent of pack.talents) {
    index.set(talent.id, talent.sourceLabel);
  }
  for (const enlighten of pack.enlightens ?? []) {
    index.set(enlighten.id, enlighten.sourceLabel);
  }

  return index;
}

export function loadKitPackSourceLabelIndex(
  kitPackPath: string,
  cwd = process.cwd(),
): Map<string, string> {
  const absolute = resolve(cwd, kitPackPath);
  const raw = JSON.parse(readFileSync(absolute, "utf8")) as KitPack;
  return buildKitPackSourceLabelIndex(raw);
}

export function resolveSourceLabelFromIndex(
  index: Map<string, string>,
  sourceKitId: string,
  proposalSourceLabel?: string | null,
): string {
  const fromPack = index.get(sourceKitId);
  if (fromPack != null) return fromPack;

  const override = proposalSourceLabel?.trim();
  if (override) return override;

  throw new Error(
    `sourceKitId "${sourceKitId}" not found in kit pack sourceLabel index`,
  );
}
