import { matchesDemandTag } from "@/lib/simulator/tag-matching";
import type { Tag } from "@/lib/team-data/types";

/**
 * Finalized damage channels. Each channel rolls up its exact tag plus all
 * descendants (`.child`) via `matchesDemandTag`. Root `Attacker.Non-Active
 * Damage` is included to cover its `.Bleed / .Counter / .Poison / .Sacrifice`
 * children (and any bare root scalar).
 */
export const DAMAGE_CHANNEL_TAGS = [
  "Attacker.Active Damage",
  "Attacker.Corrosion Damage",
  "Attacker.Ancient Embers Damage",
  "Attacker.Non-Active Damage",
  "Attacker.Tentacle",
  "Attacker.Final Verdict",
] as const;

export type DamageChannel = (typeof DAMAGE_CHANNEL_TAGS)[number];

export type DamageChannelTotal = {
  tagName: DamageChannel;
  value: number;
};

export type TotalDamageResult = {
  total: number;
  byChannel: DamageChannelTotal[];
};

/**
 * Post-engine composite: sum finalized per-tag totals across the six damage
 * channels. Display-only — never written back into `totalsByTagId`.
 */
export function computeTotalDamage(
  totalsByTagId: ReadonlyMap<number, number>,
  tagsById: Readonly<Record<number, Tag>>,
): TotalDamageResult {
  const byChannel: DamageChannelTotal[] = DAMAGE_CHANNEL_TAGS.map(
    (tagName) => ({ tagName, value: 0 }),
  );

  for (const [tagId, value] of totalsByTagId) {
    if (value === 0) continue;
    const tag = tagsById[tagId];
    if (!tag) continue;
    for (const channel of byChannel) {
      if (matchesDemandTag(tag.tagName, channel.tagName)) {
        channel.value += value;
        break;
      }
    }
  }

  const total = byChannel.reduce((sum, channel) => sum + channel.value, 0);
  return { total, byChannel };
}
