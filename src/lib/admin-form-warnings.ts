/**
 * Soft data-quality helpers for admin forms.
 * Kept client-side so TableConfig stays serializable across RSC → client.
 */

export const CREATES_AMPLIFY_CONFLICT_HINT =
  "Creates Base and Amplifies Subject usually differ: create invents a team base (true/false); amplify applies per subject (false/true).";

/** True when creates_base and amplifies_subject are the same (both true or both false). */
export function hasCreatesAmplifyConflict(
  values: Record<string, unknown>,
): boolean {
  return (
    Boolean(values.creates_base) === Boolean(values.amplifies_subject)
  );
}

export const NON_POSITIVE_INSTANCE_OR_COPIES_HINT =
  "Instances and Base Copies ≤0 zero (or shrink) this row’s Layer A contribution. Prefer ≥1.";

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** True when instance_count or base_copies is present and ≤ 0. */
export function hasNonPositiveInstanceOrCopies(
  values: Record<string, unknown>,
): boolean {
  const instances = asNumber(values.instance_count);
  const copies = asNumber(values.base_copies);
  return (
    (instances != null && instances <= 0) || (copies != null && copies <= 0)
  );
}

export {
  LOCAL_INTERACTION_COLUMN_MISMATCH_HINT,
  UNIQUE_SCALING_NON_SELF_TARGET_TYPE_HINT,
  UNIQUE_SCALING_TAG_AND_DEP_HINT,
  hasLocalInteractionColumnMismatch,
  hasUniqueScalingNonSelfTargetType,
  hasUniqueScalingTagAndDepHint,
  isBaseStatUniqueScaling,
} from "@/lib/admin-local-interaction";
