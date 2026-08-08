"use client";

import { useEffect, useId, useState } from "react";
import {
  isValidNumericInputString,
  parseNumericInput,
} from "@/components/public/diminishing-return-math";
import { Input } from "@/components/ui/input";
import { computeChaosRealmCalculator } from "@/lib/path-carver/chaos-realm-calculator";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mt.calculators.chaos-realm";

type StoredState = {
  realmMastery: string;
};

function defaultState(): StoredState {
  return { realmMastery: "0" };
}

function readStored(): StoredState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const o = parsed as Record<string, unknown>;
    if (
      typeof o.realmMastery !== "string" ||
      !isValidNumericInputString(o.realmMastery)
    ) {
      return null;
    }
    return { realmMastery: o.realmMastery };
  } catch {
    return null;
  }
}

const inputClassName = cn(
  "h-10 w-16 px-2 border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] text-[var(--mt-ink)] shadow-none tabular-nums",
  "placeholder:text-[var(--mt-ink-muted)]",
  "focus-visible:ring-[var(--mt-ember)]",
);

const sectionHeadingClass =
  "font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight";

function formatScalar(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

export function ChaosRealmCalculator() {
  const [state, setState] = useState<StoredState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const baseId = useId();
  const resultsId = useId();

  useEffect(() => {
    const stored = readStored();
    if (stored) setState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota / private-mode failures.
    }
  }, [state, hydrated]);

  function onRealmMasteryChange(value: string) {
    if (!isValidNumericInputString(value)) return;
    setState({ realmMastery: value });
  }

  const result = computeChaosRealmCalculator({
    realmMastery: parseNumericInput(state.realmMastery),
  });

  return (
    <div className="space-y-6" aria-live="polite">
      <h2
        className={cn(
          sectionHeadingClass,
          "inline-block rounded-md bg-[rgb(184_148_32)] px-3 py-1.5 text-[var(--mt-cream,#fff8f0)] shadow-sm sm:px-4",
        )}
      >
        Chaos Realm
      </h2>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={`${baseId}-rm`}
            className="min-w-[11rem] text-base text-[var(--mt-ink)]"
          >
            Realm Mastery:
          </label>
          <Input
            id={`${baseId}-rm`}
            inputMode="decimal"
            autoComplete="off"
            value={state.realmMastery}
            onChange={(e) => onRealmMasteryChange(e.target.value)}
            className={inputClassName}
            aria-describedby={resultsId}
          />
        </div>
      </div>

      <div
        id={resultsId}
        className="space-y-3 text-base text-[var(--mt-ink)]"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-[11rem]">Base Aliemus Per Posse:</span>
          <span className="font-semibold tabular-nums">
            {formatScalar(result.baseAliemusPerPosse)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-[11rem]">Aliemus Per Posse from RM:</span>
          <span className="font-semibold tabular-nums">
            {formatScalar(result.aliemusPerPosseFromRm)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-[11rem]">RM needed for +1:</span>
          <span className="font-semibold tabular-nums">
            {formatScalar(result.rmNeededForNextAliemusPerPosse)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-[11rem]">Total Aliemus Per Posse:</span>
          <span className="font-semibold tabular-nums">
            {formatScalar(result.totalAliemusPerPosse)}
          </span>
        </div>
      </div>
    </div>
  );
}
