"use client";

import { useEffect, useId, useState } from "react";
import {
  DeathResistTriggerChart,
  rawPercentNeededForNextTrigger,
} from "@/components/public/death-resist-trigger-chart";
import { Input } from "@/components/ui/input";
import {
  baseDeathResistReductionToMaxHpUp,
  baseDeathResistToInMission,
  inMissionToCauseTrigger,
} from "@/lib/path-carver/death-resist-trigger";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mt.calculators.death-resist";

/** Non-negative number: digits with at most one decimal point. Empty allowed. */
const NON_NEGATIVE_NUMERIC = /^(?:\d+(?:\.\d*)?|\.\d*)?$/;

function parseInput(value: string): number {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === ".") return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Format a percent value; trim trailing zeros after a short fixed precision. */
function formatPercent(value: number): string {
  const fixed = value.toFixed(4).replace(/\.?0+$/, "");
  return `${fixed}%`;
}

function formatNeeded(needed: number): string {
  if (needed <= 0) return "0%";
  return `${needed.toFixed(1)}%`;
}

function readStored(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("value" in parsed)
    ) {
      return null;
    }
    const value = (parsed as { value: unknown }).value;
    if (typeof value !== "string") return null;
    if (!NON_NEGATIVE_NUMERIC.test(value)) return null;
    return value;
  } catch {
    return null;
  }
}

const inputClassName = cn(
  "h-10 max-w-[10rem] border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] text-[var(--mt-ink)] shadow-none",
  "placeholder:text-[var(--mt-ink-muted)]",
  "focus-visible:ring-[var(--mt-ember)]",
);

export function DeathResistCalculator() {
  const [value, setValue] = useState("0");
  const [hydrated, setHydrated] = useState(false);
  const inputId = useId();
  const resultsId = useId();

  useEffect(() => {
    const stored = readStored();
    if (stored != null) setValue(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ value }));
    } catch {
      // Ignore quota / private-mode failures.
    }
  }, [value, hydrated]);

  function onNumericChange(next: string) {
    if (!NON_NEGATIVE_NUMERIC.test(next)) return;
    setValue(next);
  }

  const rawPercent = parseInput(value);
  const base = rawPercent / 100;
  const maxHpUpPercent = baseDeathResistReductionToMaxHpUp(base) * 100;
  const inMission = baseDeathResistToInMission(base);
  const inMissionPercent = inMission * 100;
  const triggers = inMissionToCauseTrigger(inMission);
  const neededForNext = rawPercentNeededForNextTrigger(rawPercent);

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-10">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={inputId}
            className="text-base text-[var(--mt-ink)]"
          >
            Raw Death Resist:
          </label>
          <Input
            id={inputId}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => onNumericChange(e.target.value)}
            className={inputClassName}
            aria-describedby={resultsId}
          />
          <span className="text-base text-[var(--mt-ink)]" aria-hidden>
            %
          </span>
        </div>

        <div
          id={resultsId}
          className="space-y-1 text-base text-[var(--mt-ink)]"
          aria-live="polite"
        >
          <p>
            Max HP increase:{" "}
            <span className="font-semibold tabular-nums">
              {formatPercent(maxHpUpPercent)}
            </span>
          </p>
          <p>
            In Mission Death Resist:{" "}
            <span className="font-semibold tabular-nums">
              {formatPercent(inMissionPercent)}
            </span>
          </p>
          <p>
            Number of Guaranteed Trigger:{" "}
            <span className="font-semibold tabular-nums">{triggers}</span>
          </p>
          <p>
            Death Resist needed for +1:{" "}
            <span className="font-semibold tabular-nums">
              {formatNeeded(neededForNext)}
            </span>
          </p>
        </div>
      </div>

      <DeathResistTriggerChart
        rawPercent={rawPercent}
        className="w-full shrink-0 md:w-[min(100%,22rem)]"
      />
    </div>
  );
}
