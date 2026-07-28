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
};

export function ForeignKeyCombobox({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  assetKind,
}: ForeignKeyComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedSrc =
    assetKind && selected
      ? resolveSkeydbAssetUrl(assetKind, selected.label)
      : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
                size={assetKind === "covenant" ? 28 : 20}
                darkChip={assetKind === "posse"}
              />
            ) : null}
            <span className="min-w-0 truncate">
              {selected ? selected.label : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <div className="border-b border-border p-2">
          <input
            className="flex h-8 w-full rounded-md bg-transparent px-2 text-sm outline-none placeholder:text-zinc-400"
            placeholder="Search..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          <button
            type="button"
            className="flex w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-zinc-100"
            onClick={() => {
              onChange(null);
              setOpen(false);
              setSearch("");
            }}
          >
            Clear selection
          </button>
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-zinc-500">
              No results found.
            </p>
          ) : (
            filtered.map((option) => {
              const optionSrc = assetKind
                ? resolveSkeydbAssetUrl(assetKind, option.label)
                : undefined;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-zinc-100",
                    value === option.value && "bg-zinc-100",
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
                      size={assetKind === "covenant" ? 28 : 20}
                      className="mr-2"
                      darkChip={assetKind === "posse"}
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate" title={option.label}>
                    {option.label}
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
