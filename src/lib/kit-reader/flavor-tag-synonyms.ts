/**
 * SKeyDB kit flavor / brace wording → MotherTree tag_name.
 * Embedded into every kit pack as lexicon.flavorTagSynonyms (single source).
 *
 * Resolution (Cursor skill + docs):
 * - Prefer longest / most specific synonym key (case-insensitive).
 * - Prefer *.Fixed when both parent and Fixed exist, EXCEPT Attacker.Active Damage tree.
 * - Never invent tags; ambiguous → needs_review.
 */

export type FlavorTagSynonym = {
  /** Kit wording / brace overlay (matched case-insensitively). */
  flavor: string;
  /** MotherTree tags.tag_name */
  tagName: string;
  /** When true, Fixed-prefer rule does not apply (Active Damage exception). */
  skipFixedPrefer?: boolean;
};

/** High-confidence defaults from the Kit Reader plan. */
export const FLAVOR_TAG_SYNONYMS: readonly FlavorTagSynonym[] = [
  { flavor: "Tentacle DMG", tagName: "Support.Tentacle Damage Up.Fixed" },
  { flavor: "Tentacle Damage", tagName: "Support.Tentacle Damage Up.Fixed" },
  {
    flavor: "Unique Tentacle Damage Up",
    tagName: "Support.Unique Tentacle Damage Up",
  },
  {
    flavor: "Multiply Tentacle Damage",
    tagName: "Support.Multiply Tentacle Damage",
  },
  { flavor: "Damage AMP", tagName: "Support.Damage AMP" },
  { flavor: "DMG Amplification", tagName: "Support.Damage AMP" },
  {
    flavor: "Temporary DMG Amplification",
    tagName: "Support.Damage AMP",
  },
  { flavor: "STR", tagName: "Support.STR Up.Fixed" },
  { flavor: "STR Up", tagName: "Support.STR Up.Fixed" },
  { flavor: "Strength Up", tagName: "Support.STR Up.Fixed" },
  { flavor: "Unique STR Up", tagName: "Support.Unique STR Up" },
  { flavor: "STR Down", tagName: "Defender.STR Down" },
  { flavor: "Strength Down", tagName: "Defender.STR Down" },
  { flavor: "Crit Rate", tagName: "Support.Crit Rate" },
  { flavor: "Crit. Rate", tagName: "Support.Crit Rate" },
  { flavor: "Crit DMG", tagName: "Support.Crit Damage" },
  { flavor: "Crit. DMG", tagName: "Support.Crit Damage" },
  { flavor: "Crit Damage", tagName: "Support.Crit Damage" },
  { flavor: "Vulnerable", tagName: "Support.Debuff.Vulnerability" },
  { flavor: "Vulnerability", tagName: "Support.Debuff.Vulnerability" },
  {
    flavor: "Unique Vulnerability",
    tagName: "Support.Debuff.Unique Vulnerability",
  },
  {
    flavor: "Tentacle Vulnerability",
    tagName: "Support.Debuff.Tentacle Vulnerability",
  },
  { flavor: "Weakness", tagName: "Defender.Debuff.Weakness" },
  { flavor: "Weak", tagName: "Defender.Debuff.Weakness" },
  {
    flavor: "Unique Weakness",
    tagName: "Defender.Debuff.Unique Weakness",
  },
  { flavor: "Shield", tagName: "Defender.Shield.Fixed" },
  { flavor: "Heal", tagName: "Defender.Heal.Fixed" },
  { flavor: "Healing", tagName: "Defender.Heal.Fixed" },
  { flavor: "Poison", tagName: "Attacker.Poison" },
  { flavor: "Bleed", tagName: "Attacker.Bleed" },
  { flavor: "Counter", tagName: "Attacker.Counter" },
  { flavor: "Final Verdict", tagName: "Attacker.Final Verdict" },
  { flavor: "Alert", tagName: "Defender.Alert" },
  { flavor: "Stun", tagName: "Defender.Stun" },
  { flavor: "Petrify", tagName: "Defender.Stun" },
  { flavor: "Fainted", tagName: "Defender.Stun" },
  { flavor: "Death Resistance", tagName: "Defender.Base Death Resist" },
  { flavor: "Death Resist", tagName: "Defender.Base Death Resist" },
  { flavor: "Aliemus", tagName: "Support.Aliemus" },
  { flavor: "Keyflare", tagName: "Support.Keyflare" },
  { flavor: "Realm Mastery", tagName: "Support.Realm Mastery" },
  { flavor: "Embryo Fusion", tagName: "Support.Embryo Fusion" },
  { flavor: "Arithmetica", tagName: "Support.Arithmetica" },
  { flavor: "Draw", tagName: "Support.Draw" },
  { flavor: "Discard", tagName: "Support.Discard" },
  { flavor: "Discover", tagName: "Support.Discover" },
  { flavor: "Hand Size", tagName: "Support.Hand Size" },
  { flavor: "Hand Limit", tagName: "Support.Hand Size" },
  { flavor: "Crimson Furnace", tagName: "Support.Crimson Furnace" },
  { flavor: "Fiamma", tagName: "Support.Fiamma" },
  { flavor: "Additional Instance", tagName: "Support.Additional Instance" },
  { flavor: "Final Damage", tagName: "Support.Final Damage" },
  { flavor: "Base Damage", tagName: "Support.Base Damage" },
  { flavor: "Strike Damage Up", tagName: "Support.Strike Damage Up" },
  { flavor: "Pursuit Damage Up", tagName: "Support.Pursuit Damage Up" },
  { flavor: "Corrosion", tagName: "Support.Debuff.Corrosion" },
  { flavor: "Ancient Embers", tagName: "Support.Debuff.Ancient Embers" },
  { flavor: "Self-Damage", tagName: "Special.Self Damage" },
  { flavor: "Self-Harm", tagName: "Special.Self Damage" },
  { flavor: "Creativity", tagName: "Special.Creativity" },
  {
    flavor: "Generate Temporary Tentacle",
    tagName: "Support.Generate Temporary Tentacle",
  },
  {
    flavor: "Generate Permanent Tentacle",
    tagName: "Support.Generate Permanent Tentacle",
  },
  {
    flavor: "Active Damage",
    tagName: "Attacker.Active Damage",
    skipFixedPrefer: true,
  },
  {
    flavor: "Deal DMG",
    tagName: "Attacker.Active Damage",
    skipFixedPrefer: true,
  },
  {
    flavor: "Strike",
    tagName: "Attacker.Active Damage.Strike",
    skipFixedPrefer: true,
  },
  {
    flavor: "Fixed DMG",
    tagName: "Attacker.Active Damage.Fixed Damage",
    skipFixedPrefer: true,
  },
  {
    flavor: "Fixed Damage",
    tagName: "Attacker.Active Damage.Fixed Damage",
    skipFixedPrefer: true,
  },
  {
    flavor: "Max HP DMG",
    tagName: "Attacker.Active Damage.Fixed Damage.Max HP",
    skipFixedPrefer: true,
  },
  { flavor: "Tentacle", tagName: "Attacker.Tentacle" },
] as const;

/** Pack-serializable copy (plain objects). */
export function flavorTagSynonymsForPack(): FlavorTagSynonym[] {
  return FLAVOR_TAG_SYNONYMS.map((row) => ({ ...row }));
}
