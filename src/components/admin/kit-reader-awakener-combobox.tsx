"use client";

import * as React from "react";
import { Check, ChevronsUpDown, AlertCircle, CheckCircle2, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AssetIcon } from "@/lib/assets/asset-icon";
import { resolveSkeydbAssetUrl } from "@/lib/assets/resolve-asset-url";
import { cn } from "@/lib/utils";
import type { KitReaderAwakenerOption } from "@/lib/actions/kit-reader";

type KitReaderAwakenerComboboxProps = {
  value: number | null;
  onChange: (id: number) => void;
  awakeners: KitReaderAwakenerOption[];
  disabled?: boolean;
};

type AwakenerStatus = "pending" | "verified" | "empty";

function getAwakenerStatus(option: KitReaderAwakenerOption): AwakenerStatus {
  if (option.pendingCount > 0) return "pending";
  if (option.verifiedCount > 0) return "verified";
  return "empty";
}

function StatusBadge({
  status,
  pendingCount,
  verifiedCount,
  className,
}: {
  status: AwakenerStatus;
  pendingCount: number;
  verifiedCount: number;
  className?: string;
}) {
  if (status === "pending") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700",
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {pendingCount} pending
      </span>
    );
  }

  if (status === "verified") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700",
          className,
        )}
      >
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        {verifiedCount} verified
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-400",
        className,
      )}
    >
      <CircleDashed className="h-3 w-3 text-zinc-400" />
      Empty
    </span>
  );
}

export function KitReaderAwakenerCombobox({
  value,
  onChange,
  awakeners,
  disabled = false,
}: KitReaderAwakenerComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selected = React.useMemo(
    () => awakeners.find((item) => item.id === value) ?? null,
    [awakeners, value],
  );

  const counts = React.useMemo(() => {
    let pending = 0;
    let verified = 0;
    let empty = 0;
    for (const row of awakeners) {
      if (row.pendingCount > 0) pending++;
      else if (row.verifiedCount > 0) verified++;
      else empty++;
    }
    return { pending, verified, empty, total: awakeners.length };
  }, [awakeners]);

  // Sort: pending review first, then verified, then empty, tie-breaking alphabetically
  const sortedAndFiltered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? awakeners.filter((row) => row.name.toLowerCase().includes(query))
      : [...awakeners];

    return list.sort((a, b) => {
      const aStatus = getAwakenerStatus(a);
      const bStatus = getAwakenerStatus(b);

      const statusWeight: Record<AwakenerStatus, number> = {
        pending: 0,
        verified: 1,
        empty: 2,
      };

      const diff = statusWeight[aStatus] - statusWeight[bStatus];
      if (diff !== 0) return diff;

      // If both pending, sort by higher pending count first
      if (aStatus === "pending" && b.pendingCount !== a.pendingCount) {
        return b.pendingCount - a.pendingCount;
      }

      return a.name.localeCompare(b.name);
    });
  }, [awakeners, search]);

  const selectedStatus = selected ? getAwakenerStatus(selected) : null;
  const selectedSrc = selected
    ? resolveSkeydbAssetUrl("awakener", selected.name)
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
          className="w-full max-w-md justify-between bg-white px-3 py-2 h-auto text-sm font-normal text-zinc-900 shadow-xs hover:bg-zinc-50"
        >
          <div className="flex min-w-0 items-center gap-2.5 truncate">
            {selected ? (
              <>
                <AssetIcon
                  src={selectedSrc}
                  size={24}
                  className="rounded-full ring-1 ring-zinc-200"
                />
                <span className="truncate font-medium text-zinc-900">
                  {selected.name}
                </span>
                {selectedStatus && (
                  <StatusBadge
                    status={selectedStatus}
                    pendingCount={selected.pendingCount}
                    verifiedCount={selected.verifiedCount}
                    className="shrink-0"
                  />
                )}
              </>
            ) : (
              <span className="text-zinc-500">Select Awakener...</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-zinc-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[360px] max-w-md p-0"
        align="start"
      >
        <div className="border-b border-border p-2">
          <input
            className="flex h-8 w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-2.5 text-xs outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
            placeholder="Search awakener..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
          {counts.total > 0 && (
            <div className="mt-1.5 flex items-center gap-2 px-1 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1 font-medium text-amber-700">
                <AlertCircle className="h-3 w-3" />
                {counts.pending} need review
              </span>
              <span>•</span>
              <span className="text-zinc-600">
                {counts.verified} complete
              </span>
              <span>•</span>
              <span className="text-zinc-400">{counts.empty} empty</span>
            </div>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {sortedAndFiltered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-zinc-500">
              No awakeners found matching &quot;{search}&quot;.
            </p>
          ) : (
            sortedAndFiltered.map((row) => {
              const rowStatus = getAwakenerStatus(row);
              const rowSrc = resolveSkeydbAssetUrl("awakener", row.name);
              const isSelected = row.id === value;

              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    onChange(row.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-zinc-100",
                    isSelected && "bg-zinc-100 font-medium",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <AssetIcon
                      src={rowSrc}
                      size={20}
                      className="rounded-full ring-1 ring-zinc-200"
                    />
                    <span className="truncate text-zinc-900">{row.name}</span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge
                      status={rowStatus}
                      pendingCount={row.pendingCount}
                      verifiedCount={row.verifiedCount}
                    />
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5 text-zinc-900" />
                    ) : (
                      <span className="w-3.5" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
