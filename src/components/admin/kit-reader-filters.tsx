"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AWAKENER_ENLIGHTENMENT_OPTIONS } from "@/lib/enlightenment-options";
import { ENUM_VALUES } from "@/lib/database.types";
import { cn, formatLabel } from "@/lib/utils";

export type KitReaderFiltersState = {
  enlightenment: string; // "all" | "unset" | `${number}`
  sourceType: string; // "all" | "unset" | source_type value
  searchQuery: string;
};

export const INITIAL_KIT_READER_FILTERS: KitReaderFiltersState = {
  enlightenment: "all",
  sourceType: "all",
  searchQuery: "",
};

type KitReaderFiltersProps = {
  filters: KitReaderFiltersState;
  onFilterChange: (filters: KitReaderFiltersState) => void;
  totalCount: number;
  filteredCount: number;
};

export function KitReaderFilters({
  filters,
  onFilterChange,
  totalCount,
  filteredCount,
}: KitReaderFiltersProps) {
  const isFiltered =
    filters.enlightenment !== "all" ||
    filters.sourceType !== "all" ||
    filters.searchQuery.trim() !== "";

  const handleReset = () => {
    onFilterChange(INITIAL_KIT_READER_FILTERS);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-zinc-50/70 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            type="search"
            placeholder="Search tags or metadata..."
            value={filters.searchQuery}
            onChange={(e) =>
              onFilterChange({ ...filters, searchQuery: e.target.value })
            }
            className="h-8 pl-8 text-xs bg-white"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>
            Showing <strong className="text-zinc-800">{filteredCount}</strong> of{" "}
            <strong className="text-zinc-800">{totalCount}</strong>
          </span>
          {isFiltered && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-7 px-2 text-xs text-zinc-600 hover:text-zinc-900"
            >
              <X className="mr-1 h-3 w-3" />
              Reset filters
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        {/* Enlightenment filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-zinc-600">Enlightenment:</span>
          <button
            type="button"
            onClick={() =>
              onFilterChange({ ...filters, enlightenment: "all" })
            }
            className={cn(
              "rounded px-2 py-0.5 transition-colors",
              filters.enlightenment === "all"
                ? "bg-zinc-800 font-medium text-white shadow-xs"
                : "bg-white text-zinc-700 hover:bg-zinc-200 border border-border",
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() =>
              onFilterChange({ ...filters, enlightenment: "unset" })
            }
            className={cn(
              "rounded px-2 py-0.5 transition-colors",
              filters.enlightenment === "unset"
                ? "bg-zinc-800 font-medium text-white shadow-xs"
                : "bg-white text-zinc-700 hover:bg-zinc-200 border border-border",
            )}
          >
            Base / Unset
          </button>
          {AWAKENER_ENLIGHTENMENT_OPTIONS.map((opt) => {
            const valStr = String(opt.value);
            const active = filters.enlightenment === valStr;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onFilterChange({ ...filters, enlightenment: valStr })
                }
                className={cn(
                  "rounded px-2 py-0.5 transition-colors",
                  active
                    ? "bg-zinc-800 font-medium text-white shadow-xs"
                    : "bg-white text-zinc-700 hover:bg-zinc-200 border border-border",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Source type filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-zinc-600">Source:</span>
          <button
            type="button"
            onClick={() =>
              onFilterChange({ ...filters, sourceType: "all" })
            }
            className={cn(
              "rounded px-2 py-0.5 transition-colors",
              filters.sourceType === "all"
                ? "bg-zinc-800 font-medium text-white shadow-xs"
                : "bg-white text-zinc-700 hover:bg-zinc-200 border border-border",
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() =>
              onFilterChange({ ...filters, sourceType: "unset" })
            }
            className={cn(
              "rounded px-2 py-0.5 transition-colors",
              filters.sourceType === "unset"
                ? "bg-zinc-800 font-medium text-white shadow-xs"
                : "bg-white text-zinc-700 hover:bg-zinc-200 border border-border",
            )}
          >
            Unset
          </button>
          {ENUM_VALUES.source_type.map((source) => {
            const active = filters.sourceType === source;
            return (
              <button
                key={source}
                type="button"
                onClick={() =>
                  onFilterChange({ ...filters, sourceType: source })
                }
                className={cn(
                  "rounded px-2 py-0.5 transition-colors",
                  active
                    ? "bg-zinc-800 font-medium text-white shadow-xs"
                    : "bg-white text-zinc-700 hover:bg-zinc-200 border border-border",
                )}
              >
                {formatLabel(source)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
