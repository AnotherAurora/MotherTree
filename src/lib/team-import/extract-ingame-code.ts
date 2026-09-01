const INGAME_CODE_PATTERN = /@@[A-Za-z0-9]+@@/;
export const MAX_WRAPPED_INGAME_CODE_LENGTH = 512;

export function extractIngameCode(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("@@") && trimmed.endsWith("@@")) {
    return trimmed;
  }

  const match = INGAME_CODE_PATTERN.exec(trimmed);
  return match?.[0] ?? trimmed;
}

export function assertIngameCodeLength(code: string): void {
  if (code.length > MAX_WRAPPED_INGAME_CODE_LENGTH) {
    throw new Error("Import code is too long.");
  }
}
