/**
 * Shared helpers for awakener_local_manifestation_interaction admin forms.
 * Label-swap tag field, mode defaults, and soft-warn validation.
 */

export type LocalInteractionMode = "unique_scaling" | "aftereffect";

export const LOCAL_INTERACTION_MODES: readonly LocalInteractionMode[] = [
  "unique_scaling",
  "aftereffect",
] as const;

export const UNIQUE_SCALING_MATH_OPERATIONS = [
  "multiply_one_plus",
  "add_scaled",
  "multiply",
  "presence_multiply",
] as const;

export const AFTEREFFECT_MATH_OPERATIONS = [
  "multiply",
  "add_scaled",
] as const;

export type LocalInteractionFormValues = {
  mode?: string | null;
  modifier_tag_id?: number | null;
  target_tag_id?: number | null;
  math_operation?: string | null;
  value_scalar?: number | null;
  target_type?: string | null;
  layer?: string | null;
  dependency_stat?: string | null;
  is_disabled?: boolean;
};

export function isLocalInteractionMode(
  value: unknown,
): value is LocalInteractionMode {
  return value === "unique_scaling" || value === "aftereffect";
}

export function normalizeLocalInteractionMode(
  value: unknown,
): LocalInteractionMode {
  return isLocalInteractionMode(value) ? value : "unique_scaling";
}

export function activeTagColumn(
  mode: LocalInteractionMode,
): "modifier_tag_id" | "target_tag_id" {
  return mode === "aftereffect" ? "target_tag_id" : "modifier_tag_id";
}

export function activeTagLabel(mode: LocalInteractionMode): string {
  return mode === "aftereffect" ? "Target Tag" : "Modifier Tag";
}

export function mathOperationsForMode(
  mode: LocalInteractionMode,
): readonly string[] {
  return mode === "aftereffect"
    ? AFTEREFFECT_MATH_OPERATIONS
    : UNIQUE_SCALING_MATH_OPERATIONS;
}

export function defaultsForLocalInteractionMode(
  mode: LocalInteractionMode,
): Pick<
  LocalInteractionFormValues,
  "mode" | "value_scalar" | "math_operation" | "target_type"
> {
  if (mode === "aftereffect") {
    return {
      mode,
      value_scalar: 1,
      math_operation: "multiply",
      target_type: "aoe",
    };
  }
  return {
    mode,
    value_scalar: 1,
    math_operation: "multiply_one_plus",
    target_type: "aoe",
  };
}

/** Empty draft defaults (unique_scaling). */
export function createEmptyLocalInteractionValues(): LocalInteractionFormValues {
  return {
    ...defaultsForLocalInteractionMode("unique_scaling"),
    modifier_tag_id: null,
    target_tag_id: null,
    layer: null,
    dependency_stat: null,
    is_disabled: false,
  };
}

export function getActiveTagId(
  values: LocalInteractionFormValues,
): number | null {
  const mode = normalizeLocalInteractionMode(values.mode);
  const column = activeTagColumn(mode);
  const id = values[column];
  return id == null || Number.isNaN(Number(id)) ? null : Number(id);
}

/**
 * On mode switch: move selected tag into the newly active column, null the
 * other, and coerce math_operation if disallowed in the new mode.
 */
export function applyLocalInteractionModeSwitch<
  T extends LocalInteractionFormValues,
>(current: T, nextMode: LocalInteractionMode): T {
  const previousMode = normalizeLocalInteractionMode(current.mode);
  if (previousMode === nextMode) return { ...current, mode: nextMode };

  const selectedTagId =
    getActiveTagId(current) ??
    (current.modifier_tag_id != null
      ? Number(current.modifier_tag_id)
      : current.target_tag_id != null
        ? Number(current.target_tag_id)
        : null);

  const defaults = defaultsForLocalInteractionMode(nextMode);
  const allowedOps = mathOperationsForMode(nextMode);
  const nextOp =
    current.math_operation != null &&
    allowedOps.includes(current.math_operation)
      ? current.math_operation
      : defaults.math_operation;

  return {
    ...current,
    mode: nextMode,
    modifier_tag_id:
      nextMode === "unique_scaling" ? selectedTagId : null,
    target_tag_id: nextMode === "aftereffect" ? selectedTagId : null,
    math_operation: nextOp ?? null,
    value_scalar:
      current.value_scalar == null || Number.isNaN(current.value_scalar)
        ? defaults.value_scalar!
        : current.value_scalar,
    target_type: current.target_type ?? defaults.target_type!,
  };
}

export function setActiveTagId<T extends LocalInteractionFormValues>(
  current: T,
  tagId: number | null,
): T {
  const mode = normalizeLocalInteractionMode(current.mode);
  if (mode === "aftereffect") {
    return {
      ...current,
      target_tag_id: tagId,
      modifier_tag_id: null,
    };
  }
  return {
    ...current,
    modifier_tag_id: tagId,
    target_tag_id: null,
  };
}

function nullishTagId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function nullishDependencyStat(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

/** unique_scaling with null modifier + dependency_stat (awakener base-stat invent). */
export function isBaseStatUniqueScaling(
  values: LocalInteractionFormValues | Record<string, unknown>,
): boolean {
  const mode = normalizeLocalInteractionMode(values.mode);
  if (mode !== "unique_scaling") return false;
  return (
    nullishTagId(values.modifier_tag_id) == null &&
    nullishDependencyStat(values.dependency_stat) != null
  );
}

/**
 * True when mode vs modifier/target/dep columns disagree.
 * unique_scaling: tag-mod (modifier set) or base-stat (modifier null + dep set);
 * target_tag_id always null. aftereffect: target required, modifier null.
 */
export function hasLocalInteractionColumnMismatch(
  values: Record<string, unknown>,
): boolean {
  const mode = values.mode;
  const modifier = nullishTagId(values.modifier_tag_id);
  const target = nullishTagId(values.target_tag_id);
  const dep = nullishDependencyStat(values.dependency_stat);

  if (mode === "unique_scaling") {
    if (target != null) return true;
    // Tag modifier OR base-stat (null mod + dep)
    return modifier == null && dep == null;
  }
  if (mode === "aftereffect") {
    return target == null || modifier != null;
  }
  return true;
}

export const LOCAL_INTERACTION_COLUMN_MISMATCH_HINT =
  "unique_scaling: Modifier Tag, or leave Modifier empty and set Dependency Stat (base-stat); Target Tag must be empty. aftereffect: Target Tag required; Modifier Tag empty.";

/** Soft info when unique_scaling has both a modifier tag and dependency_stat. */
export function hasUniqueScalingTagAndDepHint(
  values: Record<string, unknown>,
): boolean {
  if (values.mode !== "unique_scaling") return false;
  return (
    nullishTagId(values.modifier_tag_id) != null &&
    nullishDependencyStat(values.dependency_stat) != null
  );
}

export const UNIQUE_SCALING_TAG_AND_DEP_HINT =
  "Modifier Tag + Dependency Stat: dep scales the factor (tag-mod path). For base-stat invent, clear Modifier Tag and keep Dependency Stat.";

/** Display stored fraction as percent points (0.005 → 0.5). */
export function valueScalarToPercentDisplay(
  stored: number | null | undefined,
): string {
  if (stored == null || Number.isNaN(Number(stored))) return "";
  return String(Number(stored) * 100);
}

/** Parse percent-points input into stored fraction (0.5 → 0.005). */
export function percentDisplayToValueScalar(
  display: string,
): number | null {
  if (display === "" || display == null) return null;
  const n = Number(display);
  if (Number.isNaN(n)) return null;
  return n / 100;
}
