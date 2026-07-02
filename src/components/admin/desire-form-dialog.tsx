"use client";

import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  listDesireAnchoredAwakeners,
  saveDesireWithAnchoredAwakeners,
  type AnchoredAwakenerInput,
  type ForeignKeyOption,
} from "@/lib/actions/crud";
import { ENUM_VALUES } from "@/lib/database.types";
import type { FieldConfig, TableConfig } from "@/lib/schema-config";
import { getFormFields } from "@/lib/schema-config";

type DesireFormDialogProps = {
  config: TableConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: Record<string, unknown> | null;
  onSuccess: () => void;
};

type AnchorDraft = AnchoredAwakenerInput & {
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

function createEmptyAnchor(): AnchorDraft {
  return {
    clientKey: crypto.randomUUID(),
    awakener_id: null,
  };
}

function toAnchorDraft(row: Record<string, unknown>): AnchorDraft {
  return {
    clientKey: `existing-${String(row.id)}`,
    id: Number(row.id),
    awakener_id: row.awakener_id == null ? null : Number(row.awakener_id),
  };
}

export function DesireFormDialog({
  config,
  open,
  onOpenChange,
  record,
  onSuccess,
}: DesireFormDialogProps) {
  const isEditing = Boolean(record);
  const childConfig = config.childTables?.[0];
  const anchorFields = childConfig?.fields ?? [];

  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [anchors, setAnchors] = React.useState<AnchorDraft[]>([]);
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
    setAnchors([]);

    const desireFkFields = getFormFields(config).filter(
      (field) => field.type === "foreignKey" && field.foreignKey,
    );
    const anchorFkFields = anchorFields.filter(
      (field) => field.type === "foreignKey" && field.foreignKey,
    );

    const fkFields = [...desireFkFields, ...anchorFkFields];

    setLoadingOptions(true);

    const loadAnchors = isEditing
      ? listDesireAnchoredAwakeners(Number(record!.id)).then((result) => {
          if (result.success) {
            setAnchors(result.data.map(toAnchorDraft));
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

    Promise.all([loadAnchors, loadFkOptions]).finally(() => {
      setLoadingOptions(false);
    });
    // formSessionKey captures open/create-vs-edit transitions; config/record are read at that point only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid reset on parent re-render after create
  }, [formSessionKey]);

  function updateValue(name: string, value: unknown) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function updateAnchor(
    clientKey: string,
    field: keyof AnchoredAwakenerInput,
    value: unknown,
  ) {
    setAnchors((current) =>
      current.map((anchor) =>
        anchor.clientKey === clientKey ? { ...anchor, [field]: value } : anchor,
      ),
    );
  }

  function addAnchor() {
    setAnchors((current) => [...current, createEmptyAnchor()]);
  }

  function removeAnchor(clientKey: string) {
    setAnchors((current) =>
      current.filter((anchor) => anchor.clientKey !== clientKey),
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

      if (field.required && (value == null || value === "")) {
        toast.error(`${field.label} is required`);
        setLoading(false);
        return;
      }

      payload[field.name] = value;
    }

    for (const [index, anchor] of anchors.entries()) {
      for (const field of anchorFields) {
        const value = anchor[field.name as keyof AnchoredAwakenerInput];
        if (field.required && value == null) {
          toast.error(
            `${field.label} is required for anchored awakener ${index + 1}`,
          );
          setLoading(false);
          return;
        }
      }
    }

    const anchorPayload: AnchoredAwakenerInput[] = anchors.map(
      ({ clientKey: _clientKey, ...anchor }) => anchor,
    );

    const result = await saveDesireWithAnchoredAwakeners(
      payload,
      anchorPayload,
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

  function renderDesireField(field: FieldConfig) {
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

    return (
      <Input
        value={value == null ? "" : String(value)}
        onChange={(event) => updateValue(field.name, event.target.value)}
      />
    );
  }

  function renderAnchorField(anchor: AnchorDraft, field: FieldConfig) {
    const value = anchor[field.name as keyof AnchoredAwakenerInput];

    if (field.type === "foreignKey" && field.foreignKey) {
      return (
        <ForeignKeyCombobox
          value={value == null ? null : Number(value)}
          onChange={(next) =>
            updateAnchor(
              anchor.clientKey,
              field.name as keyof AnchoredAwakenerInput,
              next,
            )
          }
          options={fkOptions[field.name] ?? []}
          disabled={loadingOptions}
          placeholder={`Select ${field.label.toLowerCase()}...`}
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
                {renderDesireField(field)}
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
                    Linked automatically to this desire on save.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAnchor}
                  disabled={loadingOptions}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add anchored awakener
                </Button>
              </div>

              {anchors.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-zinc-500">
                  No anchored awakeners. Add one to link awakeners to this
                  desire.
                </p>
              ) : (
                <div className="space-y-3">
                  {anchors.map((anchor, index) => (
                    <div
                      key={anchor.clientKey}
                      className="space-y-3 rounded-lg border border-border bg-zinc-50 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-700">
                          Anchored Awakener {index + 1}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => removeAnchor(anchor.clientKey)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {anchorFields.map((field) => (
                          <div key={field.name}>
                            <Label className="mb-1.5 block text-xs text-zinc-600">
                              {field.label}
                              {field.required ? " *" : ""}
                            </Label>
                            {renderAnchorField(anchor, field)}
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
