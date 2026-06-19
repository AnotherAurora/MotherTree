"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
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
  createRecord,
  getForeignKeyOptions,
  updateRecord,
  type ForeignKeyOption,
} from "@/lib/actions/crud";
import { ENUM_VALUES } from "@/lib/database.types";
import type { FieldConfig, TableConfig } from "@/lib/schema-config";
import { getFormFields } from "@/lib/schema-config";

type RecordFormDialogProps = {
  config: TableConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: Record<string, unknown> | null;
  onSuccess: () => void;
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

export function RecordFormDialog({
  config,
  open,
  onOpenChange,
  record,
  onSuccess,
}: RecordFormDialogProps) {
  const isEditing = Boolean(record);
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

  function updateValue(name: string, value: unknown) {
    setValues((current) => ({ ...current, [name]: value }));
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

    const result = isEditing
      ? await updateRecord(config.name, Number(record!.id), payload)
      : await createRecord(config.name, payload);

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

  function renderField(field: FieldConfig) {
    const value = values[field.name];

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
          {getFormFields(config).map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              {renderField(field)}
            </div>
          ))}

          <div className="flex items-center gap-2 pt-2">
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
