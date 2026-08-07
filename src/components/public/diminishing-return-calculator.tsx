"use client";

import { useEffect, useId, useState } from "react";
import type { DiminishingReturnConfig } from "@/components/public/diminishing-return-config";
import {
  formatNeededForNext,
  isValidNumericInputString,
  neededForNextDiminishedPoint,
  parseNumericInput,
} from "@/components/public/diminishing-return-math";
import { DiminishingReturnStepChart } from "@/components/public/diminishing-return-step-chart";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type StoredInputs = {
  a: string;
  b: string;
};

function readStored(storageKey: string): StoredInputs | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("a" in parsed) ||
      !("b" in parsed)
    ) {
      return null;
    }
    const a = (parsed as StoredInputs).a;
    const b = (parsed as StoredInputs).b;
    if (typeof a !== "string" || typeof b !== "string") return null;
    if (!isValidNumericInputString(a) || !isValidNumericInputString(b)) {
      return null;
    }
    return { a, b };
  } catch {
    return null;
  }
}

const inputClassName = cn(
  "h-10 max-w-[10rem] border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] text-[var(--mt-ink)] shadow-none",
  "placeholder:text-[var(--mt-ink-muted)]",
  "focus-visible:ring-[var(--mt-ember)]",
);

type DiminishingReturnCalculatorProps = {
  config: DiminishingReturnConfig;
};

export function DiminishingReturnCalculator({
  config,
}: DiminishingReturnCalculatorProps) {
  const [a, setA] = useState("0");
  const [b, setB] = useState("0");
  const [hydrated, setHydrated] = useState(false);
  const aId = useId();
  const bId = useId();
  const resultId = useId();

  useEffect(() => {
    const stored = readStored(config.storageKey);
    if (stored) {
      setA(stored.a);
      setB(stored.b);
    }
    setHydrated(true);
  }, [config.storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        config.storageKey,
        JSON.stringify({ a, b }),
      );
    } catch {
      // Ignore quota / private-mode failures.
    }
  }, [a, b, hydrated, config.storageKey]);

  function onNumericChange(
    value: string,
    setValue: (next: string) => void,
  ) {
    if (!isValidNumericInputString(value)) return;
    setValue(value);
  }

  const sum = parseNumericInput(a) + parseNumericInput(b);
  const result = config.applyDr(sum);
  const neededForNext = neededForNextDiminishedPoint(config, sum);
  const nextId = `${resultId}-next`;

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-10">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base text-[var(--mt-ink)]">
            {config.rawAxisLabel}:
          </span>
          <div>
            <label htmlFor={aId} className="sr-only">
              {config.inputALabel}
            </label>
            <Input
              id={aId}
              inputMode="decimal"
              autoComplete="off"
              value={a}
              onChange={(e) => onNumericChange(e.target.value, setA)}
              className={inputClassName}
              aria-describedby={`${resultId} ${nextId}`}
            />
          </div>
          <span
            className="font-[family-name:var(--font-mother-display)] text-2xl font-semibold text-[var(--mt-ink-muted)]"
            aria-hidden
          >
            +
          </span>
          <div>
            <label htmlFor={bId} className="sr-only">
              {config.inputBLabel}
            </label>
            <Input
              id={bId}
              inputMode="decimal"
              autoComplete="off"
              value={b}
              onChange={(e) => onNumericChange(e.target.value, setB)}
              className={inputClassName}
              aria-describedby={`${resultId} ${nextId}`}
            />
          </div>
        </div>
        <div
          className="space-y-1 text-base text-[var(--mt-ink)]"
          aria-live="polite"
        >
          <p id={resultId}>
            {config.resultLabel}:{" "}
            <span className="font-semibold tabular-nums">{result}</span>
          </p>
          <p id={nextId}>
            {neededForNext == null ? (
              <>{config.maxReachedLabel}</>
            ) : (
              <>
                {config.neededForNextLabel}:{" "}
                <span className="font-semibold tabular-nums">
                  {formatNeededForNext(neededForNext)}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <DiminishingReturnStepChart
        config={config}
        rawSum={sum}
        className="w-full shrink-0 md:w-[min(100%,22rem)]"
      />
    </div>
  );
}
