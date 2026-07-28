"use client";

import { AssetIcon } from "@/lib/assets/asset-icon";
import { resolveSkeydbAssetUrl } from "@/lib/assets/resolve-asset-url";

type RealmDisplayProps = {
  value: string;
};

/** Comma-separated realm names with optional faction icons. */
export function RealmDisplay({ value }: RealmDisplayProps) {
  const names = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (names.length === 0) {
    return (
      <p className="min-h-9 select-none text-sm leading-9 text-zinc-950">
        <span className="text-zinc-400">—</span>
      </p>
    );
  }

  return (
    <p className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 select-none text-sm text-zinc-950">
      {names.map((name) => (
        <span key={name} className="inline-flex items-center gap-1.5">
          <AssetIcon
            src={resolveSkeydbAssetUrl("realm", name)}
            size={18}
          />
          <span>{name}</span>
        </span>
      ))}
    </p>
  );
}
