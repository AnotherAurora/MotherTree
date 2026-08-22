"use client";

import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DotSeparatedInput } from "@/components/admin/dot-separated-input";
import { EnumSelect } from "@/components/admin/enum-select";
import { ForeignKeyCombobox } from "@/components/admin/foreign-key-combobox";
import {
  NumberSelect,
  withOrphanNumberSelectOption,
} from "@/components/admin/number-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getForeignKeyOptions,
  listAwakenerLocalManifestationInteractions,
  saveManifestationWithOverrides,
  type AwakenerLocalManifestationInteractionInput,
  type ForeignKeyOption,
} from "@/lib/actions/crud";
import {
  LOCAL_INTERACTION_COLUMN_MISMATCH_HINT,
  UNIQUE_SCALING_NON_SELF_TARGET_TYPE_HINT,
  UNIQUE_SCALING_TAG_AND_DEP_HINT,
  activeTagLabel,
  applyLocalInteractionModeSwitch,
  createEmptyLocalInteractionValues,
  defaultTargetTypeForLocalMode,
  getActiveTagId,
  hasLocalInteractionColumnMismatch,
  hasUniqueScalingNonSelfTargetType,
  hasUniqueScalingTagAndDepHint,
  isBaseStatUniqueScaling,
  isLocalInteractionMode,
  mathOperationsForMode,
  normalizeLocalInteractionMode,
  percentDisplayToValueScalar,
  setActiveTagId,
  valueScalarToPercentDisplay,
} from "@/lib/admin-local-interaction";
import {
  NON_POSITIVE_INSTANCE_OR_COPIES_HINT,
  hasNonPositiveInstanceOrCopies,
} from "@/lib/admin-form-warnings";
import { ENUM_VALUES } from "@/lib/database.types";
import type { FieldConfig, TableConfig } from "@/lib/schema-config";
import { getFormFields } from "@/lib/schema-config";

type ManifestationFormDialogProps = {
  config: TableConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: Record<string, unknown> | null;
  initialOverrides?: AwakenerLocalManifestationInteractionInput[];
  onSuccess: () => void;
};

type OverrideDraft = AwakenerLocalManifestationInteractionInput & {
  clientKey: string;
};

function getInitialValues(
  config: TableConfig,
  record?: Record<string, unknown> | null,
) {
  const values: Record<string, unknown> = {};
  for (const field of getFormFields(config)) {
    values[field.name] = record?.[field.name] ?? field.defaultValue ?? null;
  }
  return values;
}

function createEmptyOverride(): OverrideDraft {
  const defaults = createEmptyLocalInteractionValues();
  return {
    clientKey: crypto.randomUUID(),
    mode: defaults.mode!,
    modifier_tag_id: null,
    target_tag_id: null,
    layer: null,
    math_operation: defaults.math_operation!,
    value_scalar: defaults.value_scalar!,
    target_type: defaults.target_type!,
    dependency_stat: null,
    is_disabled: false,
  };
}

function toOverrideDraft(row: Record<string, unknown>): OverrideDraft {
  return {
    clientKey: `existing-${String(row.id)}`,
    id: Number(row.id),
    mode: normalizeLocalInteractionMode(row.mode),
    modifier_tag_id:
      row.modifier_tag_id == null ? null : Number(row.modifier_tag_id),
    target_tag_id:
      row.target_tag_id == null ? null : Number(row.target_tag_id),
    layer: row.layer == null ? null : String(row.layer),
    math_operation:
      row.math_operation == null ? null : String(row.math_operation),
    value_scalar:
      row.value_scalar == null ? null : Number(row.value_scalar),
    target_type: defaultTargetTypeForLocalMode(
      normalizeLocalInteractionMode(row.mode),
      row.target_type == null ? null : String(row.target_type),
    ),
    dependency_stat:
      row.dependency_stat == null ? null : String(row.dependency_stat),
    is_disabled: Boolean(row.is_disabled),
  };
}

export function ManifestationFormDialog({
  config,
  open,
  onOpenChange,
  record,
  initialOverrides,
  onSuccess,
}: ManifestationFormDialogProps) {
  const isEditing = Boolean(record?.id != null);
  const childConfig = config.childTables?.[0];
  const overrideFields = childConfig?.fields ?? [];

  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [overrides, setOverrides] = React.useState<OverrideDraft[]>([]);
  const [fkOptions, setFkOptions] = React.useState<
    Record<string, ForeignKeyOption[]>
  >({});
  const [loading, setLoading] = React.useState(false);
  const [loadingOptions, setLoadingOptions] = React.useState(false);
  const [createMore, setCreateMore] = React.useState(false);

  const formSessionKey = open
    ? isEditing
      ? `edit:${String(record?.id ?? "")}`
      : "create"
    : "closed";

  React.useEffect(() => {
    if (!open) return;

    setCreateMore(false);
    setValues(getInitialValues(config, record));
    setOverrides(
      !isEditing && initialOverrides
        ? initialOverrides.map((override) => ({
            clientKey: crypto.randomUUID(),
            mode: normalizeLocalInteractionMode(override.mode),
            modifier_tag_id:
              override.modifier_tag_id == null
                ? null
                : Number(override.modifier_tag_id),
            target_tag_id:
              override.target_tag_id == null
                ? null
                : Number(override.target_tag_id),
            layer: override.layer == null ? null : String(override.layer),
            math_operation:
              override.math_operation == null
                ? null
                : String(override.math_operation),
            value_scalar:
              override.value_scalar == null
                ? null
                : Number(override.value_scalar),
            target_type: defaultTargetTypeForLocalMode(
              normalizeLocalInteractionMode(override.mode),
              override.target_type == null ? null : String(override.target_type),
            ),
            dependency_stat:
              override.dependency_stat == null
                ? null
                : String(override.dependency_stat),
            is_disabled: Boolean(override.is_disabled),
          }))
        : [],
    );

    const manifestationFkFields = getFormFields(config).filter(
      (field) => field.type === "foreignKey" && field.foreignKey,
    );
    const overrideFkFields = overrideFields.filter(
      (field) => field.type === "foreignKey" && field.foreignKey,
    );

    const fkFields = [...manifestationFkFields, ...overrideFkFields];

    setLoadingOptions(true);

    const loadOverrides = isEditing
      ? listAwakenerLocalManifestationInteractions(Number(record!.id)).then((result) => {
          if (result.success) {
            setOverrides(result.data.map(toOverrideDraft));
          } else {
            toast.error(result.error);
          }
        })
      : Promise.resolve();

    const loadFkOptions = Promise.all(
      fkFields.map(async (field) => {
        const fk = field.foreignKey!;
        const result = await getForeignKeyOptions(
          fk.table,
          fk.displayColumn,
          fk.labelKind,
          fk.filterBy?.column,
        );
        return {
          fieldName: field.name,
          options: result.success ? result.data : [],
        };
      }),
    ).then((results) => {
      const next: Record<string, ForeignKeyOption[]> = {};
      for (const item of results) {
        next[item.fieldName] = item.options;
      }
      setFkOptions(next);
    });

    Promise.all([loadOverrides, loadFkOptions]).finally(() => {
      setLoadingOptions(false);
    });
    // formSessionKey captures open/create-vs-edit transitions; config/record are read at that point only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid reset on parent re-render after create
  }, [formSessionKey]);

  React.useEffect(() => {
    if (loadingOptions) return;

    const replacesId = values.replaces_manifestation_id;
    if (replacesId == null) return;

    const awakenerId = values.awakener_id;
    const allOptions = fkOptions.replaces_manifestation_id ?? [];
    const currentId = record?.id == null ? null : Number(record.id);

    const isValid =
      awakenerId != null &&
      allOptions.some(
        (option) =>
          option.value === Number(replacesId) &&
          option.filterValue === Number(awakenerId) &&
          option.value !== currentId,
      );

    if (!isValid) {
      setValues((current) => ({ ...current, replaces_manifestation_id: null }));
    }
  }, [
    values.awakener_id,
    values.replaces_manifestation_id,
    fkOptions.replaces_manifestation_id,
    record?.id,
    loadingOptions,
  ]);

  function getFilteredFkOptions(field: FieldConfig): ForeignKeyOption[] {
    const allOptions = fkOptions[field.name] ?? [];
    const filterBy = field.foreignKey?.filterBy;
    if (!filterBy) return allOptions;

    const filterSource = values[filterBy.formField];
    if (filterSource == null || filterSource === "") return [];

    const currentId = record?.id == null ? null : Number(record.id);
    return allOptions.filter(
      (option) =>
        option.filterValue === Number(filterSource) &&
        option.value !== currentId,
    );
  }

  function updateValue(name: string, value: unknown) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function updateOverride(
    clientKey: string,
    field: keyof AwakenerLocalManifestationInteractionInput,
    value: unknown,
  ) {
    setOverrides((current) =>
      current.map((override) => {
        if (override.clientKey !== clientKey) return override;

        if (field === "mode" && isLocalInteractionMode(value)) {
          const { clientKey: _ck, id, ...rest } = override;
          const next = applyLocalInteractionModeSwitch(rest, value);
          return { ...override, ...next };
        }

        if (field === "modifier_tag_id" || field === "target_tag_id") {
          const tagId =
            value == null || value === "" ? null : Number(value);
          const { clientKey: _ck, id, ...rest } = override;
          return { ...override, ...setActiveTagId(rest, tagId) };
        }

        return { ...override, [field]: value };
      }),
    );
  }

  function addOverride() {
    setOverrides((current) => [...current, createEmptyOverride()]);
  }

  function removeOverride(clientKey: string) {
    setOverrides((current) =>
      current.filter((override) => override.clientKey !== clientKey),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    const payload: Record<string, unknown> = {};
    for (const field of getFormFields(config)) {
      let value = values[field.name];

      if (field.type === "number" || field.type === "id") {
        value = value === "" || value == null ? null : Number(value);
      }

      if (field.type === "boolean") {
        value = Boolean(value);
      }

      if (field.type === "dotSeparated" && value != null && value !== "") {
        const parts = String(value)
          .split(".")
          .map((part) => part.trim());
        if (parts.some((part) => !part)) {
          toast.error(`${field.label}: every segment must be filled`);
          setLoading(false);
          return;
        }
        value = parts.join(".");
      }

      if (field.required && (value == null || value === "")) {
        toast.error(`${field.label} is required`);
        setLoading(false);
        return;
      }

      payload[field.name] = value;
    }

    const overridePayload: AwakenerLocalManifestationInteractionInput[] =
      overrides.map(({ clientKey: _clientKey, ...override }) => ({
        ...override,
        mode: normalizeLocalInteractionMode(override.mode),
        value_scalar:
          override.value_scalar === null ||
          Number.isNaN(override.value_scalar)
            ? null
            : override.value_scalar,
        target_type: defaultTargetTypeForLocalMode(
          normalizeLocalInteractionMode(override.mode),
          override.target_type,
        ),
      }));

    for (const [index, override] of overridePayload.entries()) {
      if (hasLocalInteractionColumnMismatch(override)) {
        toast.error(
          `Local interaction ${index + 1}: ${LOCAL_INTERACTION_COLUMN_MISMATCH_HINT}`,
        );
        setLoading(false);
        return;
      }
      if (override.value_scalar == null) {
        toast.error(`Local interaction ${index + 1}: Value Scalar is required`);
        setLoading(false);
        return;
      }
      if (!override.target_type) {
        toast.error(`Local interaction ${index + 1}: Target Type is required`);
        setLoading(false);
        return;
      }
    }

    const result = await saveManifestationWithOverrides(
      payload,
      overridePayload,
      isEditing ? Number(record!.id) : undefined,
    );

    setLoading(false);

    if (result.success) {
      toast.success(isEditing ? "Record updated" : "Record created");
      onSuccess();
      if (!isEditing && createMore) {
        setValues((current) => ({ ...current, ...payload }));
      } else {
        onOpenChange(false);
      }
    } else {
      toast.error(result.error);
    }
  }

  function renderManifestationField(field: FieldConfig) {
    const value = values[field.name];

    if (field.type === "foreignKey" && field.foreignKey) {
      return (
        <ForeignKeyCombobox
          value={value == null ? null : Number(value)}
          onChange={(next) => updateValue(field.name, next)}
          options={getFilteredFkOptions(field)}
          disabled={loadingOptions}
          placeholder={`Select ${field.label.toLowerCase()}...`}
        />
      );
    }

    if (field.type === "enum" && field.enumName) {
      return (
        <EnumSelect
          value={value == null ? null : String(value)}
          onChange={(next) => updateValue(field.name, next)}
          options={ENUM_VALUES[field.enumName]}
        />
      );
    }

    if (field.type === "boolean") {
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => updateValue(field.name, event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Enabled
        </label>
      );
    }

    if (field.type === "textarea") {
      return (
        <Textarea
          value={value == null ? "" : String(value)}
          onChange={(event) => updateValue(field.name, event.target.value)}
        />
      );
    }

    if (field.type === "number") {
      if (field.numberSelectOptions) {
        const n =
          value === "" || value == null ? null : Number(value);
        return (
          <NumberSelect
            value={n != null && !Number.isNaN(n) ? n : null}
            onChange={(next) => updateValue(field.name, next)}
            options={withOrphanNumberSelectOption(
              field.numberSelectOptions,
              value,
            )}
            allowEmpty={!field.required && field.defaultValue == null}
          />
        );
      }
      return (
        <Input
          type="number"
          step="any"
          value={value == null ? "" : String(value)}
          onChange={(event) => updateValue(field.name, event.target.value)}
        />
      );
    }

    if (field.type === "dotSeparated") {
      return (
        <DotSeparatedInput
          value={value == null ? "" : String(value)}
          onChange={(next) => updateValue(field.name, next)}
        />
      );
    }

    return (
      <Input
        value={value == null ? "" : String(value)}
        onChange={(event) => updateValue(field.name, event.target.value)}
      />
    );
  }

  function renderOverrideField(
    override: OverrideDraft,
    field: FieldConfig,
  ) {
    const mode = normalizeLocalInteractionMode(override.mode);
    const value = override[field.name as keyof AwakenerLocalManifestationInteractionInput];

    if (field.name === "modifier_tag_id" || field.name === "target_tag_id") {
      const tagOptions =
        fkOptions.modifier_tag_id ?? fkOptions.target_tag_id ?? [];
      return (
        <ForeignKeyCombobox
          value={getActiveTagId(override)}
          onChange={(next) =>
            updateOverride(override.clientKey, "modifier_tag_id", next)
          }
          options={tagOptions}
          disabled={loadingOptions}
          placeholder={`Select ${activeTagLabel(mode).toLowerCase()}...`}
        />
      );
    }

    if (field.type === "foreignKey" && field.foreignKey) {
      return (
        <ForeignKeyCombobox
          value={value == null ? null : Number(value)}
          onChange={(next) =>
            updateOverride(
              override.clientKey,
              field.name as keyof AwakenerLocalManifestationInteractionInput,
              next,
            )
          }
          options={fkOptions[field.name] ?? []}
          disabled={loadingOptions}
          placeholder={`Select ${field.label.toLowerCase()}...`}
        />
      );
    }

    if (field.type === "enum" && field.enumName) {
      const options =
        field.name === "math_operation"
          ? mathOperationsForMode(mode)
          : field.enumName === "awakener_local_interaction_mode"
            ? ENUM_VALUES.awakener_local_interaction_mode
            : ENUM_VALUES[field.enumName];
      return (
        <EnumSelect
          value={value == null ? null : String(value)}
          onChange={(next) =>
            updateOverride(
              override.clientKey,
              field.name as keyof AwakenerLocalManifestationInteractionInput,
              next,
            )
          }
          options={options}
        />
      );
    }

    if (field.type === "boolean") {
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) =>
              updateOverride(
                override.clientKey,
                field.name as keyof AwakenerLocalManifestationInteractionInput,
                event.target.checked,
              )
            }
            className="h-4 w-4 rounded border-border"
          />
          Disabled
        </label>
      );
    }

    if (field.type === "number") {
      if (
        field.name === "value_scalar" &&
        isBaseStatUniqueScaling(override)
      ) {
        return (
          <Input
            type="number"
            step="any"
            value={valueScalarToPercentDisplay(
              value == null ? null : Number(value),
            )}
            onChange={(event) =>
              updateOverride(
                override.clientKey,
                "value_scalar",
                percentDisplayToValueScalar(event.target.value),
              )
            }
          />
        );
      }
      return (
        <Input
          type="number"
          step="any"
          value={value == null ? "" : String(value)}
          onChange={(event) =>
            updateOverride(
              override.clientKey,
              field.name as keyof AwakenerLocalManifestationInteractionInput,
              event.target.value === ""
                ? null
                : Number(event.target.value),
            )
          }
        />
      );
    }

    return null;
  }

  function overrideFieldLabel(override: OverrideDraft, field: FieldConfig) {
    if (field.name === "modifier_tag_id" || field.name === "target_tag_id") {
      return activeTagLabel(normalizeLocalInteractionMode(override.mode));
    }
    if (
      field.name === "value_scalar" &&
      isBaseStatUniqueScaling(override)
    ) {
      return "Value Scalar (%)";
    }
    return field.label;
  }

  function shouldRenderOverrideField(
    override: OverrideDraft,
    field: FieldConfig,
  ) {
    // One tag dropdown: skip target_tag_id; modifier_tag_id slot is label-swapped.
    if (field.name === "target_tag_id") return false;
    // Disable-only: engine ignores these; keep values in draft but hide controls.
    if (
      override.is_disabled &&
      (field.name === "layer" ||
        field.name === "math_operation" ||
        field.name === "value_scalar" ||
        field.name === "target_type")
    ) {
      return false;
    }
    return true;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit" : "Create"} {config.label.slice(0, -1)}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {hasNonPositiveInstanceOrCopies(values) && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {NON_POSITIVE_INSTANCE_OR_COPIES_HINT}
            </p>
          )}
          <div className="space-y-4">
            {getFormFields(config).map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required ? " *" : ""}
                </Label>
                {renderManifestationField(field)}
              </div>
            ))}
          </div>

          {childConfig && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-zinc-900">
                    {childConfig.label}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Linked automatically to this manifestation on save.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOverride}
                  disabled={loadingOptions}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add local interaction
                </Button>
              </div>

              {overrides.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-zinc-500">
                  No local interactions. Add unique_scaling or aftereffect rows
                  for this manifestation.
                </p>
              ) : (
                <div className="space-y-3">
                  {overrides.map((override, index) => (
                    <div
                      key={override.clientKey}
                      className="space-y-3 rounded-lg border border-border bg-zinc-50 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-700">
                          Local interaction {index + 1}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => removeOverride(override.clientKey)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>

                      {hasLocalInteractionColumnMismatch(override) && (
                        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          {LOCAL_INTERACTION_COLUMN_MISMATCH_HINT}
                        </p>
                      )}
                      {!hasLocalInteractionColumnMismatch(override) &&
                        hasUniqueScalingTagAndDepHint(override) && (
                          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            {UNIQUE_SCALING_TAG_AND_DEP_HINT}
                          </p>
                        )}
                      {!hasLocalInteractionColumnMismatch(override) &&
                        hasUniqueScalingNonSelfTargetType(override) && (
                          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            {UNIQUE_SCALING_NON_SELF_TARGET_TYPE_HINT}
                          </p>
                        )}

                      <div className="grid gap-3 sm:grid-cols-2">
                        {overrideFields
                          .filter((field) =>
                            shouldRenderOverrideField(override, field),
                          )
                          .map((field) => (
                          <div
                            key={field.name}
                            className={
                              field.type === "boolean" ? "sm:col-span-2" : ""
                            }
                          >
                            <Label className="mb-1.5 block text-xs text-zinc-600">
                              {overrideFieldLabel(override, field)}
                              {field.required ? " *" : ""}
                            </Label>
                            {renderOverrideField(override, field)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-border pt-2">
            {!isEditing && (
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={createMore}
                  onChange={(event) => setCreateMore(event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Create more
              </label>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || loadingOptions}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? "Save changes" : "Create record"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
