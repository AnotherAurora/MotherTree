/** Canonical awakener enlightenment breakpoints (admin ATM + Search). */
export const AWAKENER_ENLIGHTENMENT_OPTIONS = [
  { value: 0, label: "E0" },
  { value: 1, label: "E1" },
  { value: 2, label: "E2" },
  { value: 3, label: "E3" },
  { value: 7, label: "OE" },
  { value: 15, label: "AA" },
] as const;

export type AwakenerEnlightenmentValue =
  (typeof AWAKENER_ENLIGHTENMENT_OPTIONS)[number]["value"];

export const DEFAULT_AWAKENER_ENLIGHTENMENT: AwakenerEnlightenmentValue = 3;

export function isAwakenerEnlightenmentValue(
  value: number,
): value is AwakenerEnlightenmentValue {
  return AWAKENER_ENLIGHTENMENT_OPTIONS.some((o) => o.value === value);
}

/** Known breakpoint → label; otherwise the raw number as string. */
export function formatAwakenerEnlightenmentLabel(value: number): string {
  return (
    AWAKENER_ENLIGHTENMENT_OPTIONS.find((o) => o.value === value)?.label ??
    String(value)
  );
}
