"use client";

import { toast } from "sonner";
import { AssetIcon } from "@/lib/assets/asset-icon";
import { resolveSkeydbAssetUrl } from "@/lib/assets/resolve-asset-url";
import { resolveSkeydbPageUrl } from "@/lib/assets/skeydb-page-url";
import type { SearchResultRow } from "@/lib/public/search-results";
import { cn } from "@/lib/utils";

const EMPTY_DISPLAY = "—";

const COLUMNS = [
  { key: "from", label: "From" },
  { key: "name", label: "Name" },
  { key: "tag", label: "Tag" },
  { key: "targetType", label: "Target Type" },
  { key: "dependencyStat", label: "Dependency Stat" },
  { key: "valueDisplay", label: "Value" },
  { key: "buffRestriction", label: "Buff Restriction" },
  { key: "everyTurn", label: "Every Turn" },
  { key: "triggerCondition", label: "Trigger Condition" },
  { key: "requiredRealm", label: "Required Realm" },
] as const;

type SearchResultsTableProps = {
  rows: SearchResultRow[];
  truncated: boolean;
};

function isCoarsePointer(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

function NameCell({ row }: { row: SearchResultRow }) {
  const src =
    row.name !== EMPTY_DISPLAY
      ? resolveSkeydbAssetUrl(row.assetKind, row.name)
      : undefined;
  const pageUrl = resolveSkeydbPageUrl(row.assetKind, row.name);

  const icon =
    row.assetKind === "covenant" ? (
      <span
        className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm"
        style={{ width: 20, height: 20 }}
      >
        <AssetIcon
          src={src}
          alt=""
          size={20}
          className="scale-[2.1] object-cover object-center"
        />
      </span>
    ) : (
      <AssetIcon
        src={src}
        alt=""
        size={20}
        darkChip={row.assetKind === "posse"}
      />
    );

  const content = (
    <>
      {icon}
      <span>{row.name}</span>
    </>
  );

  if (!pageUrl) {
    return (
      <span className="inline-flex items-center gap-2">{content}</span>
    );
  }

  return (
    <a
      href={pageUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-2 text-[var(--mt-ember)]",
        "underline-offset-4 hover:underline hover:text-[var(--mt-ember-deep)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mt-ember)]",
      )}
    >
      {content}
    </a>
  );
}

export function SearchResultsTable({
  rows,
  truncated,
}: SearchResultsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--mt-ink-muted)]">
        No matching records.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-[var(--mt-border)] bg-[rgb(237_214_190)]">
        <table className="w-full min-w-[64rem] border-collapse text-left text-sm text-[var(--mt-ink)]">
          <thead>
            <tr className="border-b border-[var(--mt-border)]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="sticky top-0 z-10 whitespace-nowrap bg-[rgb(228_201_168)] px-3 py-2.5 font-medium text-[var(--mt-ink)]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const metadata = row.metadata;
              const hasMetadata = metadata != null;
              return (
                <tr
                  key={row.id}
                  title={hasMetadata ? metadata : undefined}
                  onClick={
                    hasMetadata
                      ? () => {
                          if (isCoarsePointer()) {
                            toast.message(metadata);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "border-b border-[var(--mt-border)]/50 odd:bg-[rgb(255_245_235_/_0.25)] hover:bg-[rgb(255_245_235_/_0.4)] last:border-b-0",
                    hasMetadata && "cursor-help",
                  )}
                >
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className="whitespace-nowrap px-3 py-2 align-middle text-[var(--mt-ink)]"
                    >
                      {col.key === "name" ? (
                        <NameCell row={row} />
                      ) : (
                        row[col.key]
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {truncated ? (
        <p className="text-sm text-[var(--mt-ink-muted)]">
          Results were truncated to the row cap. Narrow your filters for a
          complete list.
        </p>
      ) : null}
    </div>
  );
}
