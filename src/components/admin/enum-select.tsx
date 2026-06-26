"use client";

import { cn } from "@/lib/utils";

type EnumSelectProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
};

export function EnumSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
}: EnumSelectProps) {
  return (
    <select
      disabled={disabled}
      value={value ?? ""}
      onChange={(event) =>
        onChange(event.target.value === "" ? null : event.target.value)
      }
      className={cn(
        "flex h-9 w-full rounded-md border border-border bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
