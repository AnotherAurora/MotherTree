"use client";

import { cn } from "@/lib/utils";

export type NumberSelectOption = { value: number; label: string };

type NumberSelectProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  options: readonly NumberSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** When false, omit the blank option (default true). */
  allowEmpty?: boolean;
  className?: string;
};

/** Append a temporary option when `current` is not in `options`. */
export function withOrphanNumberSelectOption(
  options: readonly NumberSelectOption[],
  current: unknown,
): NumberSelectOption[] {
  const n =
    current === "" || current == null ? null : Number(current);
  if (n == null || Number.isNaN(n)) return [...options];
  if (options.some((o) => o.value === n)) return [...options];
  return [...options, { value: n, label: `Unknown (${n})` }];
}

export function NumberSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  allowEmpty = true,
  className,
}: NumberSelectProps) {
  return (
    <select
      disabled={disabled}
      value={value == null ? "" : String(value)}
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === "" ? null : Number(raw));
      }}
      className={cn(
        "flex h-9 w-full rounded-md border border-border bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {allowEmpty ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
