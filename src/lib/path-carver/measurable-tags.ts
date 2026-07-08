const PHASE2_TAG_PREFIXES = ["attack."] as const;

export function isTagMeasurable(tagName: string): boolean {
  const lower = tagName.toLowerCase();
  for (const prefix of PHASE2_TAG_PREFIXES) {
    if (lower.startsWith(prefix)) return false;
  }
  return true;
}
