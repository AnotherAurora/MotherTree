/**
 * Shared helpers for awakener_local_manifestation_interaction admin forms.
 * Label-swap tag field, mode defaults, and soft-warn validation.
 */

export type LocalInteractionMode =
  | "unique_scaling"
  | "aftereffect"
  | "direct_modifier";

export const LOCAL_INTERACTION_MODES: readonly LocalInteractionMode[] = [
  "unique_scaling",
  "aftereffect",
  "direct_modifier",
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

export const DIRECT_MODIFIER_MATH_OPERATIONS = [
  "multiply_one_plus",
  "add_scaled",
  "multiply",
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
  return (
    value === "unique_scaling" ||
    value === "aftereffect" ||
    value === "direct_modifier"
  );
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
  if (mode === "aftereffect") return "Target Tag";
  if (mode === "direct_modifier") return "Semantic Tag";
  return "Modifier Tag";
}

export function mathOperationsForMode(
  mode: LocalInteractionMode,
): readonly string[] {
  if (mode === "aftereffect") return AFTEREFFECT_MATH_OPERATIONS;
  if (mode === "direct_modifier") return DIRECT_MODIFIER_MATH_OPERATIONS;
  return UNIQUE_SCALING_MATH_OPERATIONS;
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
  if (mode === "direct_modifier") {
    return {
      mode,
      value_scalar: 1,
      math_operation: "multiply_one_plus",
      target_type: "self",
    };
  }
  return {
    mode,
    value_scalar: 1,
    math_operation: "multiply_one_plus",
    target_type: "self",
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
      nextMode === "unique_scaling" || nextMode === "direct_modifier"
        ? selectedTagId
        : null,
    target_tag_id: nextMode === "aftereffect" ? selectedTagId : null,
    math_operation: nextOp ?? null,
    value_scalar:
      current.value_scalar == null || Number.isNaN(current.value_scalar)
        ? defaults.value_scalar!
        : current.value_scalar,
    target_type:
      nextMode === "unique_scaling" || nextMode === "direct_modifier"
        ? "self"
        : (current.target_type ?? defaults.target_type!),
  };
}

/** Save fallback when target_type is empty. */
export function defaultTargetTypeForLocalMode(
  mode: LocalInteractionMode,
  current: string | null | undefined,
): string {
  if (current != null && current !== "") return current;
  return defaultsForLocalInteractionMode(mode).target_type!;
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
 * direct_modifier: target_tag_id always null, value_scalar required.
 */
export function hasLocalInteractionColumnMismatch(
  values: Record<string, unknown>,
): boolean {
  const mode = values.mode;
  const modifier = nullishTagId(values.modifier_tag_id ?? values.modifierTagId);
  const target = nullishTagId(values.target_tag_id ?? values.targetTagId);
  const dep = nullishDependencyStat(values.dependency_stat ?? values.dependencyStat);
  const val = values.value_scalar ?? values.valueScalar;

  if (mode === "unique_scaling") {
    if (target != null) return true;
    // Tag modifier OR base-stat (null mod + dep)
    return modifier == null && dep == null;
  }
  if (mode === "aftereffect") {
    return target == null || modifier != null;
  }
  if (mode === "direct_modifier") {
    if (target != null) return true;
    return val == null || Number.isNaN(Number(val));
  }
  return true;
}

export const LOCAL_INTERACTION_COLUMN_MISMATCH_HINT =
  "unique_scaling: Modifier Tag, or leave Modifier empty and set Dependency Stat (base-stat); Target Tag must be empty. aftereffect: Target Tag required; Modifier Tag empty. direct_modifier: Value Scalar required; Target Tag must be empty.";

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

/** Soft warn when unique_scaling or direct_modifier has target_type other than self. */
export function hasUniqueScalingNonSelfTargetType(
  values: Record<string, unknown>,
): boolean {
  if (values.mode !== "unique_scaling" && values.mode !== "direct_modifier") {
    return false;
  }
  const tt = values.target_type ?? values.targetType;
  if (tt == null || tt === "") return false;
  return String(tt) !== "self";
}

export const UNIQUE_SCALING_NON_SELF_TARGET_TYPE_HINT =
  "unique_scaling and direct_modifier rows should use target_type self; aoe/single have no effect on local math today.";

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
