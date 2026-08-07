"use client";

import { useEffect, useId, useState } from "react";
import { KEYFLARE_DR_CONFIG } from "@/components/public/diminishing-return-config";
import {
  formatNeededForNext,
  isValidNumericInputString,
  neededForNextDiminishedPoint,
  parseNumericInput,
} from "@/components/public/diminishing-return-math";
import { Input } from "@/components/ui/input";
import {
  TEAM_SLOT_COUNT,
  computeKeyflareHarmonyScalar,
} from "@/lib/path-carver/keyflare-harmony";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mt.calculators.keyflare-harmony";
const config = KEYFLARE_DR_CONFIG;

type SlotInputs = {
  a: string;
  b: string;
};

const EMPTY_SLOT: SlotInputs = { a: "0", b: "0" };

function emptySlots(): SlotInputs[] {
  return Array.from({ length: TEAM_SLOT_COUNT }, () => ({ ...EMPTY_SLOT }));
}

function readStored(): SlotInputs[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== TEAM_SLOT_COUNT) {
      return null;
    }
    const slots: SlotInputs[] = [];
    for (const item of parsed) {
      if (
        typeof item !== "object" ||
        item === null ||
        !("a" in item) ||
        !("b" in item)
      ) {
        return null;
      }
      const a = (item as SlotInputs).a;
      const b = (item as SlotInputs).b;
      if (typeof a !== "string" || typeof b !== "string") return null;
      if (!isValidNumericInputString(a) || !isValidNumericInputString(b)) {
        return null;
      }
      slots.push({ a, b });
    }
    return slots;
  } catch {
    return null;
  }
}

const inputClassName = cn(
  "h-10 w-14 px-2 border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] text-[var(--mt-ink)] shadow-none tabular-nums",
  "placeholder:text-[var(--mt-ink-muted)]",
  "focus-visible:ring-[var(--mt-ember)]",
);

function formatExaltPenalty(value: number): string {
  if (Object.is(value, -0) || value === 0) return "0";
  return String(value);
}

export function KeyflareHarmonyCalculator() {
  const [slots, setSlots] = useState<SlotInputs[]>(emptySlots);
  const [hydrated, setHydrated] = useState(false);
  const baseId = useId();

  useEffect(() => {
    const stored = readStored();
    if (stored) setSlots(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    } catch {
      // Ignore quota / private-mode failures.
    }
  }, [slots, hydrated]);

  function onSlotChange(
    slotIndex: number,
    field: "a" | "b",
    value: string,
  ) {
    if (!isValidNumericInputString(value)) return;
    setSlots((prev) =>
      prev.map((slot, i) =>
        i === slotIndex ? { ...slot, [field]: value } : slot,
      ),
    );
  }

  const perSlot = slots.map((slot) => {
    const sum = parseNumericInput(slot.a) + parseNumericInput(slot.b);
    const diminished = config.applyDr(sum);
    const needed = neededForNextDiminishedPoint(config, sum);
    return { sum, diminished, needed };
  });

  const harmony = computeKeyflareHarmonyScalar(
    perSlot.map((s) => ({ keyflareRegen: s.diminished })),
  );
  const regenPerTurn = harmony.valueScalar;
  const minusPerExalt = (2 / 8) * regenPerTurn * -1;

  return (
    <div className="space-y-4" aria-live="polite">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {slots.map((slot, slotIndex) => {
          const aId = `${baseId}-slot${slotIndex}-a`;
          const bId = `${baseId}-slot${slotIndex}-b`;
          const diminishedId = `${baseId}-slot${slotIndex}-diminished`;
          const neededId = `${baseId}-slot${slotIndex}-needed`;
          const result = perSlot[slotIndex];

          return (
            <div
              key={slotIndex}
              className="space-y-3 rounded-md border border-[var(--mt-border)] bg-[var(--mt-surface)] p-3"
            >
              <p className="text-sm font-medium text-[var(--mt-ink-muted)]">
                Awakener {slotIndex + 1}
              </p>

              <div className="space-y-1.5">
                <span className="text-sm text-[var(--mt-ink)]">
                  {config.rawAxisLabel}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <div>
                    <label htmlFor={aId} className="sr-only">
                      Awakener {slotIndex + 1} {config.inputALabel}
                    </label>
                    <Input
                      id={aId}
                      inputMode="decimal"
                      autoComplete="off"
                      value={slot.a}
                      onChange={(e) =>
                        onSlotChange(slotIndex, "a", e.target.value)
                      }
                      className={inputClassName}
                      aria-describedby={`${diminishedId} ${neededId}`}
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
                      Awakener {slotIndex + 1} {config.inputBLabel}
                    </label>
                    <Input
                      id={bId}
                      inputMode="decimal"
                      autoComplete="off"
                      value={slot.b}
                      onChange={(e) =>
                        onSlotChange(slotIndex, "b", e.target.value)
                      }
                      className={inputClassName}
                      aria-describedby={`${diminishedId} ${neededId}`}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-sm text-[var(--mt-ink)]">
                <p id={diminishedId}>
                  {config.resultLabel}:{" "}
                  <span className="font-semibold tabular-nums">
                    {result.diminished}
                  </span>
                </p>
                <p id={neededId}>
                  {result.needed == null ? (
                    <>{config.maxReachedLabel}</>
                  ) : (
                    <>
                      {config.neededForNextLabel}:{" "}
                      <span className="font-semibold tabular-nums">
                        {formatNeededForNext(result.needed)}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-1 text-base text-[var(--mt-ink)]">
        <p>
          Keyflare Regen per Turn:{" "}
          <span className="font-semibold tabular-nums">{regenPerTurn}</span>
        </p>
        <p>
          Minus Keyflare Regen per Exalt:{" "}
          <span className="font-semibold tabular-nums">
            {formatExaltPenalty(minusPerExalt)}
          </span>
        </p>
      </div>
    </div>
  );
}
