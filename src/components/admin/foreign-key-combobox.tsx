"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AssetIcon } from "@/lib/assets/asset-icon";
import {
  resolveSkeydbAssetUrl,
  type AssetKind,
} from "@/lib/assets/resolve-asset-url";
import { cn } from "@/lib/utils";
import type { ForeignKeyOption } from "@/lib/actions/crud";

type ForeignKeyComboboxProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  options: ForeignKeyOption[];
  placeholder?: string;
  disabled?: boolean;
  assetKind?: AssetKind;
  /** Custom trigger element; when provided, replaces the default button. */
  trigger?: React.ReactElement;
  /** `public` applies the warm desert-dusk palette to the dropdown panel. */
  appearance?: "default" | "public";
};

function optionDisplayText(option: ForeignKeyOption): string {
  return option.shortLabel ?? option.label;
}

function optionAssetSrc(
  assetKind: AssetKind | undefined,
  option: ForeignKeyOption,
): string | undefined {
  if (!assetKind) return undefined;
  return resolveSkeydbAssetUrl(assetKind, option.assetName ?? option.label);
}

function assetIconSize(assetKind: AssetKind): number {
  return assetKind === "covenant" ? 28 : 20;
}

function assetUsesDarkChip(assetKind: AssetKind): boolean {
  return assetKind === "posse" || assetKind === "stat";
}

export function ForeignKeyCombobox({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  assetKind,
  trigger,
  appearance = "default",
}: ForeignKeyComboboxProps) {
  const isPublic = appearance === "public";
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedSrc = selected
    ? optionAssetSrc(assetKind, selected)
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {trigger ? (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      ) : (
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            title={selected?.label}
            className="w-full justify-between font-normal"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              {assetKind ? (
                <AssetIcon
                  src={selectedSrc}
                  size={assetIconSize(assetKind)}
                  darkChip={assetUsesDarkChip(assetKind)}
                />
              ) : null}
              <span className="min-w-0 truncate">
                {selected ? optionDisplayText(selected) : placeholder}
              </span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
      )}
      <PopoverContent
        align="start"
        className={cn(
          "p-0",
          isPublic &&
            "border-[var(--mt-border)] bg-[rgb(255_250_245)] text-[var(--mt-ink)]",
        )}
      >
        <div
          className={cn("border-b p-2", isPublic ? "border-[var(--mt-border)]" : "border-border")}
        >
          <input
            className={cn(
              "flex h-8 w-full rounded-md px-2 text-sm outline-none",
              isPublic
                ? "border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] text-[var(--mt-ink)] placeholder:text-[var(--mt-ink-muted)] focus-visible:ring-2 focus-visible:ring-[var(--mt-ember)]"
                : "bg-transparent placeholder:text-zinc-400",
            )}
            placeholder="Search..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          <button
            type="button"
            className={cn(
              "flex w-full rounded-sm px-2 py-1.5 text-left text-sm",
              isPublic
                ? "hover:bg-[rgb(255_245_235_/_0.9)]"
                : "hover:bg-zinc-100",
            )}
            onClick={() => {
              onChange(null);
              setOpen(false);
              setSearch("");
            }}
          >
            Clear selection
          </button>
          {filtered.length === 0 ? (
            <p
              className={cn(
                "px-2 py-6 text-center text-sm",
                isPublic ? "text-[var(--mt-ink-muted)]" : "text-zinc-500",
              )}
            >
              No results found.
            </p>
          ) : (
            filtered.map((option) => {
              const optionSrc = optionAssetSrc(assetKind, option);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm",
                    isPublic
                      ? "hover:bg-[rgb(255_245_235_/_0.9)]"
                      : "hover:bg-zinc-100",
                    value === option.value &&
                      (isPublic
                        ? "bg-[rgb(255_245_235_/_0.9)]"
                        : "bg-zinc-100"),
                  )}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {assetKind ? (
                    <AssetIcon
                      src={optionSrc}
                      size={assetIconSize(assetKind)}
                      className="mr-2"
                      darkChip={assetUsesDarkChip(assetKind)}
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate" title={option.label}>
                    {optionDisplayText(option)}
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
