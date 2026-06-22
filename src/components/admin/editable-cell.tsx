"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EnumSelect } from "@/components/admin/enum-select";
import { Input } from "@/components/ui/input";
import { updateRecord } from "@/lib/actions/crud";
import { ENUM_VALUES } from "@/lib/database.types";
import type { FieldConfig } from "@/lib/schema-config";
import { cn } from "@/lib/utils";

type EditableCellProps = {
  tableName: string;
  recordId: number;
  field: FieldConfig;
  value: unknown;
  fkLabels: Record<string, string>;
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
  if (typeof value === "number") return value.toString();
  return String(value);
}

function normalizePayloadValue(field: FieldConfig, raw: unknown) {
  if (field.type === "number" || field.type === "id") {
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
  disabled = false,
  isActive,
  onActivate,
  onDeactivate,
  onUpdate,
}: EditableCellProps) {
  const [draft, setDraft] = React.useState<unknown>(value);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isActive) {
      setDraft(value);
    }
  }, [value, isActive]);

  React.useEffect(() => {
    if (isActive && field.type === "number" && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isActive, field.type]);

  async function save(nextValue: unknown) {
    if (valuesEqual(field, nextValue, value)) {
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

  if (!isActive) {
    return (
      <button
        type="button"
        disabled={disabled || saving}
        onClick={handleDisplayClick}
        className={cn(
          "group -mx-1 flex w-full items-center gap-1 rounded px-1 py-0.5 text-left",
          !disabled &&
            "cursor-pointer hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
          disabled && "cursor-default",
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {formatCellDisplayValue(field.name, value, fkLabels)}
        </span>
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

  return (
    <span onClick={(event) => event.stopPropagation()}>
      {formatCellDisplayValue(field.name, value, fkLabels)}
    </span>
  );
}
