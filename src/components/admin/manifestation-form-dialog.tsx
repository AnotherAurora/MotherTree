"use client";

import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DotSeparatedInput } from "@/components/admin/dot-separated-input";
import { EnumSelect } from "@/components/admin/enum-select";
import { ForeignKeyCombobox } from "@/components/admin/foreign-key-combobox";
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
  listInteractionOverrides,
  saveManifestationWithOverrides,
  type ForeignKeyOption,
  type InteractionOverrideInput,
} from "@/lib/actions/crud";
import { ENUM_VALUES } from "@/lib/database.types";
import type { FieldConfig, TableConfig } from "@/lib/schema-config";
import { getFormFields } from "@/lib/schema-config";

type ManifestationFormDialogProps = {
  config: TableConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: Record<string, unknown> | null;
  onSuccess: () => void;
};

type OverrideDraft = InteractionOverrideInput & {
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
  return {
    clientKey: crypto.randomUUID(),
    modifier_tag_id: null,
    math_operation: null,
    override_default_factor: null,
    target_type: null,
    dependency_stat: null,
    is_disabled: false,
  };
}

function toOverrideDraft(row: Record<string, unknown>): OverrideDraft {
  return {
    clientKey: `existing-${String(row.id)}`,
    id: Number(row.id),
    modifier_tag_id:
      row.modifier_tag_id == null ? null : Number(row.modifier_tag_id),
    math_operation:
      row.math_operation == null ? null : String(row.math_operation),
    override_default_factor:
      row.override_default_factor == null
        ? null
        : Number(row.override_default_factor),
    target_type: row.target_type == null ? null : String(row.target_type),
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
  onSuccess,
}: ManifestationFormDialogProps) {
  const isEditing = Boolean(record);
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
    setOverrides([]);

    const manifestationFkFields = getFormFields(config).filter(
      (field) => field.type === "foreignKey" && field.foreignKey,
    );
    const overrideFkFields = overrideFields.filter(
      (field) => field.type === "foreignKey" && field.foreignKey,
    );

    const fkFields = [...manifestationFkFields, ...overrideFkFields];

    setLoadingOptions(true);

    const loadOverrides = isEditing
      ? listInteractionOverrides(Number(record!.id)).then((result) => {
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
    field: keyof InteractionOverrideInput,
    value: unknown,
  ) {
    setOverrides((current) =>
      current.map((override) =>
        override.clientKey === clientKey
          ? { ...override, [field]: value }
          : override,
      ),
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

    const overridePayload: InteractionOverrideInput[] = overrides.map(
      ({ clientKey: _clientKey, ...override }) => ({
        ...override,
        override_default_factor:
          override.override_default_factor === null ||
          Number.isNaN(override.override_default_factor)
            ? null
            : override.override_default_factor,
      }),
    );

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
            className="h-4 w-4 rounded border-zinc-300"
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
    const value = override[field.name as keyof InteractionOverrideInput];

    if (field.type === "foreignKey" && field.foreignKey) {
      return (
        <ForeignKeyCombobox
          value={value == null ? null : Number(value)}
          onChange={(next) =>
            updateOverride(
              override.clientKey,
              field.name as keyof InteractionOverrideInput,
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
      return (
        <EnumSelect
          value={value == null ? null : String(value)}
          onChange={(next) =>
            updateOverride(
              override.clientKey,
              field.name as keyof InteractionOverrideInput,
              next,
            )
          }
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
            onChange={(event) =>
              updateOverride(
                override.clientKey,
                field.name as keyof InteractionOverrideInput,
                event.target.checked,
              )
            }
            className="h-4 w-4 rounded border-zinc-300"
          />
          Disabled
        </label>
      );
    }

    if (field.type === "number") {
      return (
        <Input
          type="number"
          step="any"
          value={value == null ? "" : String(value)}
          onChange={(event) =>
            updateOverride(
              override.clientKey,
              field.name as keyof InteractionOverrideInput,
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
            <div className="space-y-3 border-t border-zinc-200 pt-4">
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
                  Add override
                </Button>
              </div>

              {overrides.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
                  No interaction overrides. Add one if this manifestation needs
                  custom synergy rules.
                </p>
              ) : (
                <div className="space-y-3">
                  {overrides.map((override, index) => (
                    <div
                      key={override.clientKey}
                      className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-700">
                          Override {index + 1}
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

                      <div className="grid gap-3 sm:grid-cols-2">
                        {overrideFields.map((field) => (
                          <div
                            key={field.name}
                            className={
                              field.type === "boolean" ? "sm:col-span-2" : ""
                            }
                          >
                            <Label className="mb-1.5 block text-xs text-zinc-600">
                              {field.label}
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

          <div className="flex items-center gap-2 border-t border-zinc-200 pt-2">
            {!isEditing && (
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={createMore}
                  onChange={(event) => setCreateMore(event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
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
