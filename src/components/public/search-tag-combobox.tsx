"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatSearchTagLabel } from "@/lib/public/search-filter-options";
import { cn } from "@/lib/utils";

export type SearchTagComboboxOption = {
  id: number;
  tag_name: string;
};

type SearchTagComboboxProps = {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  options: readonly SearchTagComboboxOption[];
  placeholder?: string;
  "aria-labelledby"?: string;
};

export function SearchTagCombobox({
  id,
  value,
  onChange,
  options,
  placeholder = "No Filter",
  "aria-labelledby": ariaLabelledBy,
}: SearchTagComboboxProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = options.find((option) => option.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) =>
      formatSearchTagLabel(option.tag_name).toLowerCase().includes(q),
    );
  }, [options, search]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] px-2 text-left text-sm text-[var(--mt-ink)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mt-ember)]",
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {selected ? formatSearchTagLabel(selected.tag_name) : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] max-w-[min(100vw-2rem,28rem)] border-[var(--mt-border)] bg-[rgb(255_250_245)] p-0 text-[var(--mt-ink)] shadow-md"
      >
        <div className="border-b border-[var(--mt-border)] p-2">
          <input
            className="flex h-9 w-full rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] px-2 text-sm outline-none placeholder:text-[var(--mt-ink-muted)] focus-visible:ring-2 focus-visible:ring-[var(--mt-ember)]"
            placeholder="Search tags..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
        </div>
        <div id={listboxId} role="listbox" className="max-h-64 overflow-y-auto p-1">
          <button
            type="button"
            role="option"
            aria-selected={value == null}
            className={cn(
              "flex w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-[rgb(255_245_235_/_0.9)]",
              value == null && "bg-[rgb(255_245_235_/_0.9)]",
            )}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            No Filter
          </button>
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-[var(--mt-ink-muted)]">
              No tags found.
            </p>
          ) : (
            filtered.map((option) => {
              const isSelected = value === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-[rgb(255_245_235_/_0.9)]",
                    isSelected && "bg-[rgb(255_245_235_/_0.9)]",
                  )}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 whitespace-normal break-words">
                    {formatSearchTagLabel(option.tag_name)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
