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

  return `Use the MotherTree Kit Reader skill to propose and insert pending ATMs.

Awakener: ${input.awakenerName}
Kit pack: ${packPath}
Proposal destination: ${proposalPath}
SKeyDB commit: ${commit}

1. Read ${packPath} and propose compact ATM + local rows following the Kit Reader skill rules (sparse JSON: omit defaults, ignore-list items, and redundant quotes).
2. Write sparse proposal JSON to ${proposalPath}.
3. Insert pending rows via CLI:
   npx tsx --env-file=.env.local scripts/insert-kit-pending.ts ${proposalPath}
4. Summarize inserted rows and any needs_review items.`;
}
