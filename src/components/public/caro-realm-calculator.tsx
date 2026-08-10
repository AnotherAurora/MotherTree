"use client";

import {
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
} from "react";
import { CalculatorPendingHydration } from "@/components/public/calculator-pending-hydration";
import { CalculatorStatRow } from "@/components/public/calculator-stat-row";
import {
  isValidNumericInputString,
  parseNumericInput,
} from "@/components/public/diminishing-return-math";
import { Input } from "@/components/ui/input";
import {
  computeCaroRealmCalculator,
  type CaroRealmMode,
} from "@/lib/path-carver/caro-realm-calculator";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mt.calculators.caro-realm";

type StoredState = {
  mode: CaroRealmMode;
  teamMaxHp: string;
  currentHp: string;
  realmMastery: string;
  primordiaChaos: boolean;
  pureRealm: boolean;
};

function defaultState(): StoredState {
  return {
    mode: "caro",
    teamMaxHp: "0",
    currentHp: "0",
    realmMastery: "0",
    primordiaChaos: false,
    pureRealm: false,
  };
}

function isRealmMode(v: unknown): v is CaroRealmMode {
  return v === "caro" || v === "propagation";
}

/** Keep current HP from exceeding team max HP when both are valid numbers. */
function clampCurrentHpString(teamMaxHp: string, currentHp: string): string {
  if (!isValidNumericInputString(teamMaxHp) || teamMaxHp === "") {
    return currentHp;
  }
  if (!isValidNumericInputString(currentHp) || currentHp === "") {
    return currentHp;
  }
  const maxHp = parseNumericInput(teamMaxHp);
  const hp = parseNumericInput(currentHp);
  if (!(maxHp > 0) || !(hp > maxHp)) return currentHp;
  return String(maxHp);
}

function readNumericString(value: unknown, fallback: string): string {
  return typeof value === "string" && isValidNumericInputString(value)
    ? value
    : fallback;
}

function readStored(): StoredState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const o = parsed as Record<string, unknown>;
    const defaults = defaultState();

    const teamMaxHp = readNumericString(o.teamMaxHp, defaults.teamMaxHp);
    const currentHp = clampCurrentHpString(
      teamMaxHp,
      readNumericString(o.currentHp, defaults.currentHp),
    );
    const primordiaChaos =
      typeof o.primordiaChaos === "boolean"
        ? o.primordiaChaos
        : defaults.primordiaChaos;
    const pureRealm =
      typeof o.pureRealm === "boolean" ? o.pureRealm : defaults.pureRealm;

    return {
      mode: isRealmMode(o.mode) ? o.mode : defaults.mode,
      teamMaxHp,
      currentHp,
      realmMastery: readNumericString(o.realmMastery, defaults.realmMastery),
      primordiaChaos,
      pureRealm: primordiaChaos ? false : pureRealm,
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

const sectionHeadingClass =
  "font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight";

function formatScalar(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

/** Always one decimal for First Devour base / RM rows. */
function formatOneDecimal(value: number): string {
  return value.toFixed(1);
}

const MODE_OPTIONS: { value: CaroRealmMode; label: string }[] = [
  { value: "caro", label: "Caro Realm" },
  { value: "propagation", label: "Propagation Caro Realm" },
];

export function CaroRealmCalculator() {
  const [state, setState] = useState<StoredState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const baseId = useId();
  const resultsId = useId();
  const modeGroupId = useId();
  const isPropagation = state.mode === "propagation";

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

  function onTeamMaxHpChange(value: string) {
    if (!isValidNumericInputString(value)) return;
    setState((prev) => ({
      ...prev,
      teamMaxHp: value,
      currentHp: clampCurrentHpString(value, prev.currentHp),
    }));
  }

  function onCurrentHpChange(value: string) {
    if (!isValidNumericInputString(value)) return;
    setState((prev) => ({
      ...prev,
      currentHp: clampCurrentHpString(prev.teamMaxHp, value),
    }));
  }

  function onRealmMasteryChange(value: string) {
    if (!isValidNumericInputString(value)) return;
    setState((prev) => ({ ...prev, realmMastery: value }));
  }

  function onModeChange(mode: CaroRealmMode) {
    setState((prev) => ({ ...prev, mode }));
  }

  function onModeKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = MODE_OPTIONS.findIndex((o) => o.value === state.mode);
    if (idx < 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onModeChange(MODE_OPTIONS[(idx + 1) % MODE_OPTIONS.length].value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onModeChange(
        MODE_OPTIONS[(idx - 1 + MODE_OPTIONS.length) % MODE_OPTIONS.length]
          .value,
      );
    }
  }

  const result = computeCaroRealmCalculator({
    mode: state.mode,
    teamMaxHp: parseNumericInput(state.teamMaxHp),
    currentHp: parseNumericInput(state.currentHp),
    realmMastery: parseNumericInput(state.realmMastery),
    primordiaChaos: state.primordiaChaos,
    pureRealm: state.pureRealm,
  });

  if (!hydrated) {
    return <CalculatorPendingHydration />;
  }

  return (
    <div className="space-y-6" aria-live="polite">
      <div className="space-y-2">
        <p
          id={`${modeGroupId}-label`}
          className="text-sm font-medium text-[var(--mt-ink-muted)]"
        >
          Realm mode
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`${modeGroupId}-label`}
          className="inline-flex max-w-full flex-wrap rounded-lg border-2 border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.35)] p-1"
          onKeyDown={onModeKeyDown}
        >
          {MODE_OPTIONS.map((option) => {
            const selected = state.mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => onModeChange(option.value)}
                className={cn(
                  sectionHeadingClass,
                  "rounded-md px-3 py-1.5 text-left transition-colors sm:px-4",
                  selected
                    ? "bg-[rgb(160_40_50)] text-[var(--mt-cream,#fff8f0)] shadow-sm"
                    : "text-[var(--mt-ink-muted)] hover:bg-[rgb(255_245_235_/_0.7)] hover:text-[var(--mt-ink)]",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={`${baseId}-max-hp`}
            className="min-w-[11rem] text-base text-[var(--mt-ink)]"
          >
            Team Max HP:
          </label>
          <Input
            id={`${baseId}-max-hp`}
            inputMode="decimal"
            autoComplete="off"
            value={state.teamMaxHp}
            onChange={(e) => onTeamMaxHpChange(e.target.value)}
            className={inputClassName}
            aria-describedby={resultsId}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={`${baseId}-current-hp`}
            className="min-w-[11rem] text-base text-[var(--mt-ink)]"
          >
            Current HP:
          </label>
          <Input
            id={`${baseId}-current-hp`}
            inputMode="decimal"
            autoComplete="off"
            value={state.currentHp}
            onChange={(e) => onCurrentHpChange(e.target.value)}
            className={inputClassName}
            aria-describedby={resultsId}
          />
        </div>

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

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={`${baseId}-primordia`}
            className="min-w-[11rem] text-base text-[var(--mt-ink)]"
          >
            Primordia Chaos:
          </label>
          <input
            id={`${baseId}-primordia`}
            type="checkbox"
            checked={state.primordiaChaos}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                primordiaChaos: e.target.checked,
                pureRealm: e.target.checked ? false : prev.pureRealm,
              }))
            }
            className="size-4 accent-[var(--mt-ember)]"
          />
        </div>

        {!state.primordiaChaos ? (
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={`${baseId}-pure`}
              className="min-w-[11rem] text-base text-[var(--mt-ink)]"
            >
              Pure Realm:
            </label>
            <input
              id={`${baseId}-pure`}
              type="checkbox"
              checked={state.pureRealm}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  pureRealm: e.target.checked,
                }))
              }
              className="size-4 accent-[var(--mt-ember)]"
            />
          </div>
        ) : null}
      </div>

      <div id={resultsId} className="space-y-4 text-base text-[var(--mt-ink)]">
        <div className="space-y-2">
          <h3 className="font-[family-name:var(--font-mother-display)] text-xl font-semibold tracking-tight text-[var(--mt-ink)]">
            At Turn Start
          </h3>
          <CalculatorStatRow
            label="Base Embryo Fusion Regen:"
            value={formatScalar(result.baseEmbryoFusionRegen)}
          />
          <CalculatorStatRow
            label="Base Crimson Furnace Regen:"
            value={formatScalar(result.baseCrimsonFurnaceRegen)}
          />
          {!isPropagation ? (
            <CalculatorStatRow
              label="Battle End Crimson Furnace Gain:"
              value={formatScalar(result.battleEndCrimsonFurnaceGain)}
            />
          ) : null}
          {isPropagation ? (
            <div className="mt-2 space-y-2 border-t border-[var(--mt-border)]/40 pt-3">
              <h4 className="text-sm font-medium text-[var(--mt-ink-muted)]">
                Team Propagation Fiesta
              </h4>
              <CalculatorStatRow
                label="Base Propagation Fiesta:"
                value={formatScalar(result.basePropagationFiesta)}
              />
              <CalculatorStatRow
                label="Propagation Fiesta from RM:"
                value={formatScalar(result.propagationFiestaFromRm)}
              />
              <CalculatorStatRow
                label="Total Propagation Fiesta:"
                value={formatScalar(result.totalPropagationFiesta)}
              />
            </div>
          ) : null}
        </div>

        {isPropagation ? (
          <div className="space-y-2 border-t border-[var(--mt-border)]/40 pt-3">
            <h3 className="font-[family-name:var(--font-mother-display)] text-xl font-semibold tracking-tight text-[var(--mt-ink)]">
              Embryo Propagation Fiesta Values
            </h3>
            <CalculatorStatRow
              label="Base Embryo:"
              value={formatScalar(result.basePropaguleFiesta)}
            />
            <CalculatorStatRow
              label="Embryo from RM:"
              value={formatScalar(result.propaguleFiestaFromRm)}
            />
            <CalculatorStatRow
              label="Total Embryo:"
              value={formatScalar(result.totalPropaguleFiesta)}
            />
          </div>
        ) : (
          <div className="space-y-4 border-t border-[var(--mt-border)]/40 pt-3">
            <h3 className="font-[family-name:var(--font-mother-display)] text-xl font-semibold tracking-tight text-[var(--mt-ink)]">
              First Devour
            </h3>
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[var(--mt-ink-muted)]">
                Shield
              </h4>
              <CalculatorStatRow
                label="Base Shield:"
                value={formatOneDecimal(result.baseShield)}
              />
              <CalculatorStatRow
                label="Shield from RM:"
                value={formatOneDecimal(result.shieldFromRm)}
              />
              <CalculatorStatRow
                label="Total Shield:"
                value={formatScalar(result.totalShield)}
              />
            </div>
            <div className="space-y-2 border-t border-[var(--mt-border)]/40 pt-3">
              <h4 className="text-sm font-medium text-[var(--mt-ink-muted)]">
                STR
              </h4>
              <CalculatorStatRow
                label="Base STR:"
                value={formatOneDecimal(result.baseStr)}
              />
              <CalculatorStatRow
                label="STR from RM:"
                value={formatOneDecimal(result.strFromRm)}
              />
              <CalculatorStatRow
                label="Total STR:"
                value={formatScalar(result.totalStr)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
