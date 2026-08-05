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

export {
  LOCAL_INTERACTION_COLUMN_MISMATCH_HINT,
  UNIQUE_SCALING_TAG_AND_DEP_HINT,
  hasLocalInteractionColumnMismatch,
  hasUniqueScalingTagAndDepHint,
  isBaseStatUniqueScaling,
} from "@/lib/admin-local-interaction";
