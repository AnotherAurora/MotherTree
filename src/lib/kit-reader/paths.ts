import { join } from "node:path";

export const KIT_READER_DIR_RELATIVE = "sample-data/kit-reader";

export function kitPackRelativePath(slug: string): string {
  return `${KIT_READER_DIR_RELATIVE}/${slug}.kit.json`;
}

export function kitPackAbsolutePath(repoRoot: string, slug: string): string {
  return join(repoRoot, KIT_READER_DIR_RELATIVE, `${slug}.kit.json`);
}

export function kitProposalRelativePath(slug: string): string {
  return `${KIT_READER_DIR_RELATIVE}/${slug}.proposal.json`;
}

export function kitProposalAbsolutePath(repoRoot: string, slug: string): string {
  return join(repoRoot, KIT_READER_DIR_RELATIVE, `${slug}.proposal.json`);
}
