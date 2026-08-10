"use client";

import { useEffect, useId, useState } from "react";
import { CalculatorPendingHydration } from "@/components/public/calculator-pending-hydration";
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

const CHAOS_AWAKENER_RAW_DEATH_RESIST_BONUS = 100;

type StoredState = {
  value: string;
  primordiaChaos: boolean;
  chaosAwakenerExist: boolean;
};

function defaultState(): StoredState {
  return {
    value: "0",
    primordiaChaos: false,
    chaosAwakenerExist: false,
  };
}

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

function readStored(): StoredState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || !("value" in parsed)) {
      return null;
    }
    const o = parsed as Record<string, unknown>;
    if (typeof o.value !== "string") return null;
    if (!NON_NEGATIVE_NUMERIC.test(o.value)) return null;
    return {
      value: o.value,
      primordiaChaos:
        typeof o.primordiaChaos === "boolean" ? o.primordiaChaos : false,
      chaosAwakenerExist:
        typeof o.chaosAwakenerExist === "boolean"
          ? o.chaosAwakenerExist
          : false,
    };
  } catch {
    return null;
  }
}

const inputClassName = cn(
  "h-10 w-16 px-2 border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] text-[var(--mt-ink)] shadow-none tabular-nums",
  "placeholder:text-[var(--mt-ink-muted)]",
  "focus-visible:ring-[var(--mt-ember)]",
);

export function DeathResistCalculator() {
  const [state, setState] = useState<StoredState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const baseId = useId();
  const resultsId = useId();

  useEffect(() => {
    const stored = readStored();
    if (stored != null) {
      setState(
        stored.primordiaChaos
          ? { ...stored, chaosAwakenerExist: false }
          : stored,
      );
    }
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

  function onNumericChange(next: string) {
    if (!NON_NEGATIVE_NUMERIC.test(next)) return;
    setState((prev) => ({ ...prev, value: next }));
  }

  const typedRawPercent = parseInput(state.value);
  const effectiveRawPercent =
    typedRawPercent +
    (state.chaosAwakenerExist ? CHAOS_AWAKENER_RAW_DEATH_RESIST_BONUS : 0);
  const base = effectiveRawPercent / 100;
  const maxHpUpPercent = baseDeathResistReductionToMaxHpUp(base) * 100;
  const inMission = baseDeathResistToInMission(base);
  const inMissionPercent = inMission * 100;
  const triggers = inMissionToCauseTrigger(inMission);
  const neededForNext = rawPercentNeededForNextTrigger(effectiveRawPercent);

  if (!hydrated) {
    return <CalculatorPendingHydration />;
  }

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-10">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={`${baseId}-raw-dr`}
              className="text-base text-[var(--mt-ink)]"
            >
              Raw Death Resist:
            </label>
            <Input
              id={`${baseId}-raw-dr`}
              inputMode="decimal"
              autoComplete="off"
              value={state.value}
              onChange={(e) => onNumericChange(e.target.value)}
              className={inputClassName}
              aria-describedby={resultsId}
            />
            <span className="text-base text-[var(--mt-ink)]" aria-hidden>
              %
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={`${baseId}-primordia`}
              className="text-base text-[var(--mt-ink)]"
            >
              Primordia Chaos:
            </label>
            <input
              id={`${baseId}-primordia`}
              type="checkbox"
              checked={state.primordiaChaos}
              onChange={(e) => {
                const checked = e.target.checked;
                setState((prev) => ({
                  ...prev,
                  primordiaChaos: checked,
                  ...(checked ? { chaosAwakenerExist: false } : {}),
                }));
              }}
              className="size-4 accent-[var(--mt-ember)]"
            />
          </div>

          {!state.primordiaChaos ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor={`${baseId}-chaos-exist`}
                  className="text-base text-[var(--mt-ink)]"
                >
                  Chaos Awakener Exist:
                </label>
                <input
                  id={`${baseId}-chaos-exist`}
                  type="checkbox"
                  checked={state.chaosAwakenerExist}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      chaosAwakenerExist: e.target.checked,
                    }))
                  }
                  className="size-4 accent-[var(--mt-ember)]"
                />
              </div>
              {state.chaosAwakenerExist ? (
                <p className="text-sm text-[var(--mt-ink-muted)]">
                  100% Raw Death Resist was added
                </p>
              ) : null}
            </div>
          ) : null}
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
        rawPercent={effectiveRawPercent}
        className="w-full shrink-0 md:w-[min(100%,22rem)]"
      />
    </div>
  );
}
