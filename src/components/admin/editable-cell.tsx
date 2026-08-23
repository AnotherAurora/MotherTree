"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EnumSelect } from "@/components/admin/enum-select";
import { ForeignKeyCombobox } from "@/components/admin/foreign-key-combobox";
import {
  NumberSelect,
  withOrphanNumberSelectOption,
} from "@/components/admin/number-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateRecord, type ForeignKeyOption } from "@/lib/actions/crud";
import { ENUM_VALUES } from "@/lib/database.types";
import { formatAwakenerEnlightenmentLabel } from "@/lib/enlightenment-options";
import type { FieldConfig } from "@/lib/schema-config";
import { cn } from "@/lib/utils";

type EditableCellProps = {
  tableName: string;
  recordId: number;
  field: FieldConfig;
  value: unknown;
  fkLabels: Record<string, string>;
  fkOptions?: ForeignKeyOption[];
  disabled?: boolean;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onUpdate: (updated: Record<string, unknown>) => void;
};

export function formatCellDisplayValue(
  fieldName: string,
  value: unknown,
  fkLabels: Record<string, string>,
) {
  if (value == null || value === "") return "—";

  const fkLabel = fkLabels[`${fieldName}:${value}`];
  if (fkLabel) return fkLabel;

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (fieldName === "required_enlightenment" && typeof value === "number") {
    return formatAwakenerEnlightenmentLabel(value);
  }
  if (typeof value === "number") return value.toString();
  return String(value);
}

function normalizePayloadValue(field: FieldConfig, raw: unknown) {
  if (
    field.type === "number" ||
    field.type === "id" ||
    field.type === "foreignKey"
  ) {
    return raw === "" || raw == null ? null : Number(raw);
  }

  if (field.type === "boolean") {
    return Boolean(raw);
  }

  return raw === "" ? null : raw;
}

function valuesEqual(field: FieldConfig, a: unknown, b: unknown) {
  const normalizedA = normalizePayloadValue(field, a);
  const normalizedB = normalizePayloadValue(field, b);

  if (normalizedA == null && normalizedB == null) return true;
  if (typeof normalizedA === "number" && typeof normalizedB === "number") {
    return normalizedA === normalizedB;
  }
  return normalizedA === normalizedB;
}

export function EditableCell({
  tableName,
  recordId,
  field,
  value,
  fkLabels,
  fkOptions = [],
  disabled = false,
  isActive,
  onActivate,
  onDeactivate,
  onUpdate,
}: EditableCellProps) {
  const [draft, setDraft] = React.useState<unknown>(value);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!isActive) {
      setDraft(value);
    }
  }, [value, isActive]);

  React.useEffect(() => {
    if (!isActive) return;
    if (
      (field.type === "number" || field.type === "text") &&
      inputRef.current
    ) {
      inputRef.current.focus();
      inputRef.current.select();
      return;
    }
    if (field.type === "textarea" && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isActive, field.type]);

  async function save(nextValue: unknown) {
    if (valuesEqual(field, nextValue, value)) {
      onDeactivate();
      return;
    }

    if (
      (field.type === "text" || field.type === "textarea") &&
      field.required &&
      (nextValue == null || String(nextValue).trim() === "")
    ) {
      toast.error(`${field.label} is required`);
      setDraft(value);
      onDeactivate();
      return;
    }

    if (
      field.type === "foreignKey" &&
      field.required &&
      (nextValue == null || nextValue === "")
    ) {
      toast.error(`${field.label} is required`);
      setDraft(value);
      onDeactivate();
      return;
    }

    const payloadValue = normalizePayloadValue(field, nextValue);
    setSaving(true);

    const result = await updateRecord(tableName, recordId, {
      [field.name]: payloadValue,
    });

    setSaving(false);

    if (result.success) {
      onUpdate(result.data);
      onDeactivate();
      return;
    }

    toast.error(result.error);
    setDraft(value);
    onDeactivate();
  }

  function handleDisplayClick(event: React.MouseEvent) {
    event.stopPropagation();
    if (disabled || saving) return;
    onActivate();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      void save(draft);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(value);
      onDeactivate();
    }
  }

  function handleTextareaKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(value);
      onDeactivate();
      return;
    }
    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      void save(draft);
    }
  }

  if (!isActive) {
    const display = formatCellDisplayValue(field.name, value, fkLabels);
    const cellTitle =
      field.name === "copy_provider_group_id" &&
      value != null &&
      value !== ""
        ? display
        : field.type === "textarea" && display !== "—"
          ? String(display)
          : undefined;

    return (
      <button
        type="button"
        disabled={disabled || saving}
        title={cellTitle}
        onClick={handleDisplayClick}
        className={cn(
          "group -mx-1 flex w-full items-center gap-1 rounded px-1 py-0.5 text-left",
          !disabled &&
            "cursor-pointer hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
          disabled && "cursor-default",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{display}</span>
        {saving && (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" />
        )}
      </button>
    );
  }

  if (field.type === "enum" && field.enumName) {
    const options = ENUM_VALUES[field.enumName] ?? [];
    return (
      <div className="min-w-32" onClick={(event) => event.stopPropagation()}>
        <EnumSelect
          value={draft == null ? null : String(draft)}
          onChange={(next) => {
            setDraft(next);
            void save(next);
          }}
          options={options}
          disabled={saving}
        />
        {saving && (
          <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin text-zinc-400" />
        )}
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <label
        className="flex items-center gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={Boolean(draft)}
          disabled={saving}
          onChange={(event) => {
            const next = event.target.checked;
            setDraft(next);
            void save(next);
          }}
        />
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
      </label>
    );
  }

  if (field.type === "number") {
    if (field.numberSelectOptions) {
      const n =
        draft === "" || draft == null ? null : Number(draft);
      return (
        <div className="min-w-24" onClick={(event) => event.stopPropagation()}>
          <NumberSelect
            value={n != null && !Number.isNaN(n) ? n : null}
            onChange={(next) => {
              setDraft(next);
              void save(next);
            }}
            options={withOrphanNumberSelectOption(
              field.numberSelectOptions,
              draft,
            )}
            allowEmpty={!field.required && field.defaultValue == null}
            disabled={saving}
            className="h-8"
          />
          {saving && (
            <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin text-zinc-400" />
          )}
        </div>
      );
    }
    return (
      <div className="min-w-20" onClick={(event) => event.stopPropagation()}>
        <Input
          ref={inputRef}
          type="number"
          value={draft == null ? "" : String(draft)}
          disabled={saving}
          className="h-8"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void save(draft)}
          onKeyDown={handleKeyDown}
        />
        {saving && (
          <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin text-zinc-400" />
        )}
      </div>
    );
  }

  if (field.type === "text") {
    return (
      <div className="min-w-20" onClick={(event) => event.stopPropagation()}>
        <Input
          ref={inputRef}
          type="text"
          value={draft == null ? "" : String(draft)}
          disabled={saving}
          className="h-8"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void save(draft)}
          onKeyDown={handleKeyDown}
        />
        {saving && (
          <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin text-zinc-400" />
        )}
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="min-w-0" onClick={(event) => event.stopPropagation()}>
        <Textarea
          ref={textareaRef}
          value={draft == null ? "" : String(draft)}
          disabled={saving}
          className="min-h-[72px] text-sm"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void save(draft)}
          onKeyDown={handleTextareaKeyDown}
        />
        {saving && (
          <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin text-zinc-400" />
        )}
      </div>
    );
  }

  if (field.type === "foreignKey" && field.foreignKey) {
    return (
      <div className="min-w-40" onClick={(event) => event.stopPropagation()}>
        <ForeignKeyCombobox
          value={draft == null ? null : Number(draft)}
          onChange={(next) => {
            setDraft(next);
            void save(next);
          }}
          options={fkOptions}
          disabled={saving}
          placeholder={`Select ${field.label.toLowerCase()}...`}
        />
        {saving && (
          <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin text-zinc-400" />
        )}
      </div>
    );
  }

  return (
    <span onClick={(event) => event.stopPropagation()}>
      {formatCellDisplayValue(field.name, value, fkLabels)}
    </span>
  );
}
