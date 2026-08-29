import { SKEYDB_COMMIT } from "@/lib/assets/skeydb-base";
import { kitPackRelativePath, kitProposalRelativePath } from "./paths";

export type CursorPromptInput = {
  awakenerName: string;
  slug: string;
  skeydbCommit?: string;
};

export type ReviewPromptRowContext = {
  id: number;
  tagName: string | null;
  metadata: string | null;
  valueScalar: number | null;
  dependencyStat: string | null;
  instanceCount: number;
  baseCopies: number;
  requiredEnlightenment: number | null;
  sourceType: string | null;
  targetType: string | null;
  buffTargetTypeRestriction: string | null;
  replacesManifestationId: number | null;
};

export type ReviewPromptInput = {
  awakenerName: string;
  awakenerId: number;
  slug: string;
  rows?: ReviewPromptRowContext[];
};

export function formatReviewPromptRow(row: ReviewPromptRowContext): string {
  const parts: string[] = [];
  if (row.valueScalar != null) {
    parts.push(
      row.dependencyStat ? `${row.valueScalar} (${row.dependencyStat})` : `${row.valueScalar}`,
    );
  }
  if (row.instanceCount > 1) {
    parts.push(`instances=${row.instanceCount}`);
  }
  if (row.baseCopies > 1) {
    parts.push(`base_copies=${row.baseCopies}`);
  }
  if (row.requiredEnlightenment != null && row.requiredEnlightenment > 0) {
    parts.push(`E=${row.requiredEnlightenment}`);
  }
  if (row.replacesManifestationId != null) {
    parts.push(`replaces=#${row.replacesManifestationId}`);
  }
  if (row.buffTargetTypeRestriction != null) {
    parts.push(`restriction=${row.buffTargetTypeRestriction}`);
  }
  const metaLabel = row.metadata ? ` · "${row.metadata}"` : "";
  const tagLabel = row.tagName ?? "no-tag";
  const details = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  return `- #${row.id} · ${tagLabel}${metaLabel}${details}`;
}

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

/** Paste-ready Cursor Agent prompt for surgical review edits in a new chat. */
export function buildKitReaderReviewPrompt(input: ReviewPromptInput): string {
  const proposalPath = kitProposalRelativePath(input.slug);
  const packPath = kitPackRelativePath(input.slug);

  const contextSection =
    input.rows && input.rows.length > 0
      ? `\nContext:\n${input.rows.map(formatReviewPromptRow).join("\n")}\n`
      : "";

  return `${input.awakenerName} — Kit Reader review edit (surgical).

Use the MotherTree Kit Reader Review skill.
Do NOT read ${packPath} or other awakener kit/proposal files.
Do NOT regenerate or re-insert all pending rows.
Do NOT touch any records except those explicitly specified below.

Awakener: ${input.awakenerName} (id ${input.awakenerId})
Proposal: ${proposalPath}
${contextSection}
Changes:
1. 

Report ONLY: changed IDs, skipped IDs, and any blockers.`;
}
