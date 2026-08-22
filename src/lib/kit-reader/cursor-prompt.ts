import { SKEYDB_COMMIT } from "@/lib/assets/skeydb-base";
import { kitPackRelativePath, kitProposalRelativePath } from "./paths";

export type CursorPromptInput = {
  awakenerName: string;
  slug: string;
  skeydbCommit?: string;
};

/** Paste-ready Cursor Agent prompt after kit pack export. */
export function buildKitReaderCursorPrompt(input: CursorPromptInput): string {
  const commit = input.skeydbCommit ?? SKEYDB_COMMIT;
  const packPath = kitPackRelativePath(input.slug);
  const proposalPath = kitProposalRelativePath(input.slug);

  return `Use the MotherTree Kit Reader skill and docs/admin/kit-reader.md
plus docs/admin/atm-and-local-interaction-inputs.md.

Awakener: ${input.awakenerName}
Kit pack: ${packPath}
SKeyDB commit: ${commit}

1. Read the kit pack (skill layers, standalone enlightens, atmEligible talents, ignore list,
   lexicon.tags + lexicon.flavorTagSynonyms + lexicon.percentDependencyStats;
   use sourceLabel / sourceLabelHint; per layer read resolvedArgs AND resolvedArgMeta).
2. Propose ATM + local rows for Path Carver (enlighten replace-vs-add;
   Soulforge kit-specific only). Resolve tagName via pack
   lexicon.flavorTagSynonyms; prefer .Fixed except Attacker.Active Damage
   (rarely fixed — only Fixed Damage / Max HP when kit says so); never invent tags.
   When kit scales per 1% of a percent awakener stat (death_resist, damage_amp, …),
   use value_scalar rate/10000 (see proposal-heuristics helpers), not the linear RM rate/100.
   Omit proposal metadata (CLI builds it from sourceLabel + tagName; strips trailing
   .Fixed — e.g. tagName Support.Tentacle Damage Up.Fixed → inserted "AA Tentacle Damage Up").
   Use metadataSuffix / metadataOverride for custom labels only;
   set isAccumulating true only for at-turn-start/end every-turn effects.
   Enjoy/enjoying/enjoys → unique_scaling local on subject ATM (not modifier ATM);
   enjoy + Tentacle DMG → two add_scaled locals (Tentacle Damage Up + Unique);
   unique_scaling locals use targetType self; lexicon.aoeTagPrefixes applies to ATM targetType only.
   {Steal} / Steal + STR → two ok ATMs: Defender.STR Down + Support.STR Up.Fixed (same scalar);
   plain STR reduction without Steal → STR Down only.
   resolvedArgMeta: stat + % suffix → dependencyStat (atk/def/con) and valueScalar = ArgN/100
   for Power/Block/Damage/Poison/Exhaustion channel args; hasSubstatBonus → needs_review.
3. Never create ATMs for Gnostic Potential, Madness Omen, Dimensional Image,
   or Soulforge Astral Reign / CON·ATK·DEF% / first-Rouse Keyflare.
   AbsoluteAxiom → requiredEnlightenment 15 (AA); OverExalt → 7 (OE).
4. Write the proposal JSON to ${proposalPath} (schemaVersion 1; see
   src/lib/kit-reader/proposal-schema.ts). Metadata is optional — insert CLI computes it.
   Do not set verified — the CLI forces false.
5. Run the insert CLI (pending only; aborts if pending ATMs already exist):

   npx tsx --env-file=.env.local scripts/insert-kit-pending.ts ${proposalPath}

6. Summarize inserted vs skipped/unsupported. Do not hand the user JSON to paste into admin.`;
}
