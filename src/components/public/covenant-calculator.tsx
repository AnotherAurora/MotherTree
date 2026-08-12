"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { CalculatorPendingHydration } from "@/components/public/calculator-pending-hydration";
import {
  COVENANT_SLOT_LABELS,
  COVENANT_STATS,
  COVENANT_STAT_LABELS,
  MAIN_STAT_OPTIONS_BY_SLOT,
  SUB_STAT_LEVEL_MAX,
  SUB_STAT_LEVEL_MIN,
  formatCovenantStatValue,
  isCovenantStatId,
  isMainStatAllowedForSlot,
  mainContribution,
  subContribution,
  sumContributions,
  type CovenantPieceInput,
  type CovenantStatId,
} from "@/lib/public/covenant-stats";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mt.calculators.covenant";
const SUB_COUNT = 3;
const SLOT_COUNT = COVENANT_SLOT_LABELS.length;

type SubRowState = {
  subStat: CovenantStatId | null;
  level: number;
};

type PieceState = {
  mainStat: CovenantStatId | null;
  bonded: boolean;
  subs: SubRowState[];
};

function emptySub(): SubRowState {
  return { subStat: null, level: SUB_STAT_LEVEL_MIN };
}

function emptyPiece(): PieceState {
  return {
    mainStat: null,
    bonded: false,
    subs: Array.from({ length: SUB_COUNT }, emptySub),
  };
}

function emptyPieces(): PieceState[] {
  return Array.from({ length: SLOT_COUNT }, emptyPiece);
}

function parseLevel(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < SUB_STAT_LEVEL_MIN || value > SUB_STAT_LEVEL_MAX) return null;
  return value;
}

function parseStat(value: unknown): CovenantStatId | null {
  if (value === null) return null;
  if (typeof value !== "string" || !isCovenantStatId(value)) return null;
  return value;
}

function readStored(): PieceState[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== SLOT_COUNT) return null;

    const pieces: PieceState[] = [];
    for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex++) {
      const item = parsed[slotIndex];
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;
      if (!("mainStat" in record) || !("bonded" in record) || !("subs" in record)) {
        return null;
      }
      if (typeof record.bonded !== "boolean") return null;
      if (!Array.isArray(record.subs) || record.subs.length !== SUB_COUNT) {
        return null;
      }

      let mainStat = parseStat(record.mainStat);
      if (
        mainStat != null &&
        !isMainStatAllowedForSlot(slotIndex, mainStat)
      ) {
        mainStat = null;
      }

      const subs: SubRowState[] = [];
      for (const subItem of record.subs) {
        if (typeof subItem !== "object" || subItem === null) return null;
        const subRecord = subItem as Record<string, unknown>;
        if (!("subStat" in subRecord) || !("level" in subRecord)) return null;
        const subStat = parseStat(subRecord.subStat);
        const level = parseLevel(subRecord.level);
        if (level == null) return null;
        subs.push({ subStat, level });
      }

      pieces.push({ mainStat, bonded: record.bonded, subs });
    }
    return pieces;
  } catch {
    return null;
  }
}

const selectClassName = cn(
  "h-10 min-w-[10.5rem] rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] px-2 text-sm text-[var(--mt-ink)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mt-ember)]",
);

const levelSelectClassName = cn(
  "h-10 w-16 rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] px-2 text-sm text-[var(--mt-ink)] tabular-nums",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mt-ember)]",
);

const valueClassName =
  "min-w-[3.5rem] text-sm tabular-nums text-[var(--mt-ink)]";

const fieldLabelClassName = "shrink-0 text-sm text-[var(--mt-ink-muted)]";

const headingClass =
  "font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight text-[var(--mt-ink)]";
function formatRowValue(
  stat: CovenantStatId | null,
  value: number,
): string {
  if (stat == null) return "—";
  return formatCovenantStatValue(stat, value);
}

export function CovenantCalculator() {
  const [pieces, setPieces] = useState<PieceState[]>(emptyPieces);
  const [hydrated, setHydrated] = useState(false);
  const baseId = useId();

  useEffect(() => {
    const stored = readStored();
    if (stored) setPieces(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pieces));
    } catch {
      // Ignore quota / private-mode failures.
    }
  }, [pieces, hydrated]);

  function setPiece(slotIndex: number, next: PieceState) {
    setPieces((prev) =>
      prev.map((piece, i) => (i === slotIndex ? next : piece)),
    );
  }

  const totals = sumContributions(pieces as CovenantPieceInput[]);

  if (!hydrated) {
    return <CalculatorPendingHydration />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <Link
          href="/calculators"
          className="inline-block text-sm font-medium text-[var(--mt-ember)] underline underline-offset-4 hover:text-[var(--mt-ember-deep)]"
        >
          ← Calculators
        </Link>
        <h1 className={cn(headingClass, "mt-4")}>Covenant</h1>
        <p className="mt-3 max-w-2xl text-[var(--mt-ink-muted)]">
          Main Stat and Sub Stat totals across six Covenant slots.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
        <div className="space-y-6">
          {pieces.map((piece, slotIndex) => {
            const roman = COVENANT_SLOT_LABELS[slotIndex];
            const mainOptions = MAIN_STAT_OPTIONS_BY_SLOT[slotIndex];
            const mainId = `${baseId}-slot${slotIndex}-main`;
            const bondId = `${baseId}-slot${slotIndex}-bond`;
            const mainValue = mainContribution(piece.mainStat, piece.bonded);

            return (
              <section
                key={roman}
                className="space-y-3 border-b border-[var(--mt-border)] pb-6 last:border-b-0 last:pb-0"
                aria-labelledby={`${baseId}-slot${slotIndex}-title`}
              >
                <h2
                  id={`${baseId}-slot${slotIndex}-title`}
                  className="font-[family-name:var(--font-mother-display)] text-2xl font-semibold text-[var(--mt-ink)]"
                >
                  {roman}
                </h2>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label htmlFor={mainId} className={fieldLabelClassName}>
                      Main
                    </label>
                    <select
                      id={mainId}
                      className={selectClassName}
                      value={piece.mainStat ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        const mainStat =
                          value === ""
                            ? null
                            : isCovenantStatId(value) &&
                                isMainStatAllowedForSlot(slotIndex, value)
                              ? value
                              : null;
                        setPiece(slotIndex, {
                          ...piece,
                          mainStat,
                          bonded: mainStat == null ? false : piece.bonded,
                        });
                      }}
                    >
                      <option value="">—</option>
                      {mainOptions.map((stat) => (
                        <option key={stat} value={stat}>
                          {COVENANT_STAT_LABELS[stat]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className={valueClassName} aria-live="polite">
                    {formatRowValue(piece.mainStat, mainValue)}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      id={bondId}
                      type="checkbox"
                      checked={piece.bonded}
                      disabled={piece.mainStat == null}
                      onChange={(e) =>
                        setPiece(slotIndex, {
                          ...piece,
                          bonded: e.target.checked,
                        })
                      }
                      className="size-4 accent-[var(--mt-ember)] disabled:opacity-50"
                    />
                    <label
                      htmlFor={bondId}
                      className="text-sm text-[var(--mt-ink)]"
                    >
                      Bond
                    </label>
                  </div>
                </div>

                <div className="space-y-2 pl-4 sm:pl-6">
                  {piece.subs.map((sub, subIndex) => {
                    const subId = `${baseId}-slot${slotIndex}-sub${subIndex}`;
                    const levelId = `${baseId}-slot${slotIndex}-level${subIndex}`;
                    const subValue = subContribution(sub.subStat, sub.level);

                    return (
                      <div
                        key={subIndex}
                        className="flex flex-wrap items-center gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={subId}
                            className={fieldLabelClassName}
                          >
                            Sub
                          </label>
                          <select
                            id={subId}
                            className={selectClassName}
                            value={sub.subStat ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              const subStat =
                                value === ""
                                  ? null
                                  : isCovenantStatId(value)
                                    ? value
                                    : null;
                              const nextSubs = piece.subs.map((row, i) =>
                                i === subIndex ? { ...row, subStat } : row,
                              );
                              setPiece(slotIndex, {
                                ...piece,
                                subs: nextSubs,
                              });
                            }}
                          >
                            <option value="">—</option>
                            {COVENANT_STATS.map((stat) => (
                              <option key={stat} value={stat}>
                                {COVENANT_STAT_LABELS[stat]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={levelId}
                            className={fieldLabelClassName}
                          >
                            Lv
                          </label>
                          <select
                            id={levelId}
                            className={levelSelectClassName}
                            value={sub.level}
                            onChange={(e) => {
                              const level = Number(e.target.value);
                              const nextSubs = piece.subs.map((row, i) =>
                                i === subIndex ? { ...row, level } : row,
                              );
                              setPiece(slotIndex, {
                                ...piece,
                                subs: nextSubs,
                              });
                            }}
                          >
                            {Array.from(
                              {
                                length:
                                  SUB_STAT_LEVEL_MAX - SUB_STAT_LEVEL_MIN + 1,
                              },
                              (_, i) => SUB_STAT_LEVEL_MIN + i,
                            ).map((level) => (
                              <option key={level} value={level}>
                                {level}
                              </option>
                            ))}
                          </select>
                        </div>
                        <span className={valueClassName} aria-live="polite">
                          {formatRowValue(sub.subStat, subValue)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <aside
          className="space-y-3 border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.35)] p-4 lg:sticky lg:top-6"
          aria-live="polite"
        >
          <h2 className="font-[family-name:var(--font-mother-display)] text-xl font-semibold text-[var(--mt-ink)]">
            Totals
          </h2>
          {totals.length === 0 ? (
            <p className="text-sm text-[var(--mt-ink-muted)]">
              No stats selected.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm text-[var(--mt-ink)]">
              {totals.map((entry) => (
                <li
                  key={entry.stat}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span>{COVENANT_STAT_LABELS[entry.stat]}</span>
                  <span className="font-semibold tabular-nums">
                    {formatCovenantStatValue(entry.stat, entry.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
