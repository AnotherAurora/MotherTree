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

  return `${input.awakenerName} — Kit Reader: Propose and insert pending ATMs.

Use the MotherTree Kit Reader skill.
Kit pack: ${packPath}
Proposal destination: ${proposalPath}
SKeyDB commit: ${commit}

1. Read ONLY ${packPath} and required skill documentation (do NOT read other awakener kit or proposal files in sample-data/kit-reader/). Propose compact ATM + local rows following the Kit Reader skill rules (sparse JSON: omit defaults, ignore-list items, and redundant quotes).
2. Write sparse proposal JSON to ${proposalPath}.
3. Insert pending rows via CLI:
   npx tsx --env-file=.env.local scripts/insert-kit-pending.ts ${proposalPath}
4. Report ONLY: (a) total count of inserted rows & locals, (b) any needs_review items with rationale, and (c) ignored items. Do NOT print tables, breakdowns, or lists of successfully inserted rows.`;
}
