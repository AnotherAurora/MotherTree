"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
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
  createRecord,
  getForeignKeyOptions,
  updateRecord,
  type ForeignKeyOption,
} from "@/lib/actions/crud";
import {
  LOCAL_INTERACTION_COLUMN_MISMATCH_HINT,
  UNIQUE_SCALING_NON_SELF_TARGET_TYPE_HINT,
  UNIQUE_SCALING_TAG_AND_DEP_HINT,
  activeTagLabel,
  applyLocalInteractionModeSwitch,
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
import { ENUM_VALUES } from "@/lib/database.types";
import type { FieldConfig, TableConfig } from "@/lib/schema-config";
import { getFormFields } from "@/lib/schema-config";

type RecordFormDialogProps = {
  config: TableConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: Record<string, unknown> | null;
  onSuccess: (saved: Record<string, unknown>) => void;
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

type FormFieldGroup =
  | { kind: "full"; field: FieldConfig }
  | { kind: "half"; fields: FieldConfig[] };

function groupFormFields(fields: FieldConfig[]): FormFieldGroup[] {
  const groups: FormFieldGroup[] = [];

  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    if (field.formWidth === "half") {
      const batch: FieldConfig[] = [field];
      while (
        index + 1 < fields.length &&
        fields[index + 1].formWidth === "half"
      ) {
        index++;
        batch.push(fields[index]);
      }
      groups.push({ kind: "half", fields: batch });
      continue;
    }
    groups.push({ kind: "full", field });
  }

  return groups;
}

export function RecordFormDialog({
  config,
  open,
  onOpenChange,
  record,
  onSuccess,
}: RecordFormDialogProps) {
  const isEditing = Boolean(record?.id != null);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [fkOptions, setFkOptions] = React.useState<
    Record<string, ForeignKeyOption[]>
  >({});
  const [loading, setLoading] = React.useState(false);
  const [loadingOptions, setLoadingOptions] = React.useState(false);
  const [createMore, setCreateMore] = React.useState(false);

  // Only reset the form when the dialog opens or the edit target changes —
  // not when parent re-renders pass a new config object reference after create.
  const formSessionKey = open
    ? isEditing
      ? `edit:${String(record?.id ?? "")}`
      : "create"
    : "closed";

  React.useEffect(() => {
    if (!open) return;
    setCreateMore(false);
    setValues(getInitialValues(config, record));

    const fkFields = getFormFields(config).filter(
      (field) => field.type === "foreignKey" && field.foreignKey,
    );

    if (fkFields.length === 0) return;

    setLoadingOptions(true);
    Promise.all(
      fkFields.map(async (field) => {
        const fk = field.foreignKey!;
        const result = await getForeignKeyOptions(
          fk.table,
          fk.displayColumn,
          fk.labelKind,
        );
        return {
          fieldName: field.name,
          options: result.success ? result.data : [],
        };
      }),
    )
      .then((results) => {
        const next: Record<string, ForeignKeyOption[]> = {};
        for (const item of results) {
          next[item.fieldName] = item.options;
        }
        setFkOptions(next);
      })
      .finally(() => setLoadingOptions(false));
    // formSessionKey captures open/create-vs-edit transitions; config/record are read at that point only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid reset on parent re-render after create
  }, [formSessionKey]);

  const isLocalInteraction =
    config.name === "awakener_local_manifestation_interaction";
  const localMode = isLocalInteraction
    ? normalizeLocalInteractionMode(values.mode)
    : null;

  function updateValue(name: string, value: unknown) {
    setValues((current) => {
      if (!isLocalInteraction) {
        return { ...current, [name]: value };
      }

      if (name === "mode" && isLocalInteractionMode(value)) {
        return applyLocalInteractionModeSwitch(current, value);
      }

      if (name === "modifier_tag_id" || name === "target_tag_id") {
        const tagId =
          value == null || value === "" ? null : Number(value);
        return setActiveTagId(current, tagId);
      }

      return { ...current, [name]: value };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    const payload: Record<string, unknown> = {};
    for (const field of getFormFields(config)) {
      let value = values[field.name];

      if (field.type === "number" || field.type === "id") {
        value =
          value === "" || value == null ? null : Number(value);
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

    if (isLocalInteraction) {
      if (hasLocalInteractionColumnMismatch(payload)) {
        toast.error(LOCAL_INTERACTION_COLUMN_MISMATCH_HINT);
        setLoading(false);
        return;
      }
      payload.mode = normalizeLocalInteractionMode(payload.mode);
      payload.target_type = defaultTargetTypeForLocalMode(
        payload.mode as "unique_scaling" | "aftereffect",
        payload.target_type == null ? null : String(payload.target_type),
      );
    }

    const result = isEditing
      ? await updateRecord(config.name, Number(record!.id), payload)
      : await createRecord(config.name, payload);

    setLoading(false);

    if (result.success) {
      toast.success(isEditing ? "Record updated" : "Record created");
      onSuccess(result.data);
      if (!isEditing && createMore) {
        setValues((current) => ({ ...current, ...payload }));
      } else {
        onOpenChange(false);
      }
    } else {
      toast.error(result.error);
    }
  }

  function shouldRenderField(field: FieldConfig) {
    if (isLocalInteraction && field.name === "target_tag_id") return false;
    // Disable-only: engine ignores these; keep values in form state but hide controls.
    if (
      isLocalInteraction &&
      Boolean(values.is_disabled) &&
      (field.name === "layer" ||
        field.name === "math_operation" ||
        field.name === "value_scalar" ||
        field.name === "target_type")
    ) {
      return false;
    }
    return true;
  }

  function renderField(field: FieldConfig) {
    const value = values[field.name];

    if (
      isLocalInteraction &&
      (field.name === "modifier_tag_id" || field.name === "target_tag_id")
    ) {
      const tagOptions =
        fkOptions.modifier_tag_id ?? fkOptions.target_tag_id ?? [];
      return (
        <ForeignKeyCombobox
          value={getActiveTagId(values)}
          onChange={(next) => updateValue("modifier_tag_id", next)}
          options={tagOptions}
          disabled={loadingOptions}
          placeholder={`Select ${activeTagLabel(localMode!).toLowerCase()}...`}
        />
      );
    }

    if (field.type === "foreignKey" && field.foreignKey) {
      return (
        <ForeignKeyCombobox
          value={value == null ? null : Number(value)}
          onChange={(next) => updateValue(field.name, next)}
          options={fkOptions[field.name] ?? []}
          disabled={loadingOptions}
          placeholder={`Select ${field.label.toLowerCase()}...`}
        />
      );
    }

    if (field.type === "enum" && field.enumName) {
      const options =
        isLocalInteraction && field.name === "math_operation" && localMode
          ? mathOperationsForMode(localMode)
          : ENUM_VALUES[field.enumName];
      return (
        <EnumSelect
          value={value == null ? null : String(value)}
          onChange={(next) => updateValue(field.name, next)}
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
      if (
        isLocalInteraction &&
        field.name === "value_scalar" &&
        isBaseStatUniqueScaling(values)
      ) {
        return (
          <Input
            type="number"
            step="any"
            value={valueScalarToPercentDisplay(
              value == null || value === "" ? null : Number(value),
            )}
            onChange={(event) =>
              updateValue(
                field.name,
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

  function renderFieldLabel(field: FieldConfig) {
    let label = field.label;
    if (
      isLocalInteraction &&
      (field.name === "modifier_tag_id" || field.name === "target_tag_id") &&
      localMode
    ) {
      label = activeTagLabel(localMode);
    } else if (
      isLocalInteraction &&
      field.name === "value_scalar" &&
      isBaseStatUniqueScaling(values)
    ) {
      label = "Value Scalar (%)";
    }

    const requireAsterisk =
      field.required ||
      (isLocalInteraction &&
        localMode === "aftereffect" &&
        (field.name === "modifier_tag_id" || field.name === "target_tag_id"));

    return (
      <Label htmlFor={field.name}>
        {label}
        {requireAsterisk ? " *" : ""}
      </Label>
    );
  }

  function renderFieldGroup(group: FormFieldGroup) {
    if (group.kind === "full") {
      if (!shouldRenderField(group.field)) return null;
      return (
        <div key={group.field.name} className="space-y-2">
          {renderFieldLabel(group.field)}
          {renderField(group.field)}
        </div>
      );
    }

    const visible = group.fields.filter(shouldRenderField);
    if (visible.length === 0) return null;

    return (
      <div
        key={visible.map((field) => field.name).join("-")}
        className="grid gap-3 sm:grid-cols-2"
      >
        {visible.map((field) => (
          <div key={field.name} className="space-y-2">
            {renderFieldLabel(field)}
            {renderField(field)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit" : "Create"} {config.label.slice(0, -1)}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isLocalInteraction &&
            hasLocalInteractionColumnMismatch(values) && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {LOCAL_INTERACTION_COLUMN_MISMATCH_HINT}
              </p>
            )}
          {isLocalInteraction &&
            !hasLocalInteractionColumnMismatch(values) &&
            hasUniqueScalingTagAndDepHint(values) && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {UNIQUE_SCALING_TAG_AND_DEP_HINT}
              </p>
            )}
          {isLocalInteraction &&
            !hasLocalInteractionColumnMismatch(values) &&
            hasUniqueScalingNonSelfTargetType(values) && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {UNIQUE_SCALING_NON_SELF_TARGET_TYPE_HINT}
              </p>
            )}

          {groupFormFields(getFormFields(config)).map(renderFieldGroup)}

          <div className="flex items-center gap-2 pt-2">
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
