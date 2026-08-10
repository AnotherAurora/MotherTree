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
  computeUltraRealmCalculator,
  type UltraRealmMode,
} from "@/lib/path-carver/ultra-realm-calculator";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mt.calculators.ultra-realm";

type StoredState = {
  mode: UltraRealmMode;
  teamMaxHp: string;
  realmMastery: string;
  primordiaChaos: boolean;
  pureRealm: boolean;
  chaosAwakeners: number;
};

function defaultState(): StoredState {
  return {
    mode: "ultra",
    teamMaxHp: "0",
    realmMastery: "0",
    primordiaChaos: false,
    pureRealm: false,
    chaosAwakeners: 0,
  };
}

function isChaosCount(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 3;
}

function isUltraRealmMode(v: unknown): v is UltraRealmMode {
  return v === "ultra" || v === "singularity";
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

    const chaosAwakeners = isChaosCount(o.chaosAwakeners)
      ? o.chaosAwakeners
      : defaults.chaosAwakeners;
    const pureRealm =
      typeof o.pureRealm === "boolean" ? o.pureRealm : defaults.pureRealm;

    return {
      mode: isUltraRealmMode(o.mode) ? o.mode : defaults.mode,
      teamMaxHp: readNumericString(o.teamMaxHp, defaults.teamMaxHp),
      realmMastery: readNumericString(o.realmMastery, defaults.realmMastery),
      primordiaChaos:
        typeof o.primordiaChaos === "boolean"
          ? o.primordiaChaos
          : defaults.primordiaChaos,
      pureRealm: chaosAwakeners > 0 ? true : pureRealm,
      chaosAwakeners,
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

const selectClassName = cn(
  "h-10 rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] px-2 text-sm text-[var(--mt-ink)] tabular-nums",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mt-ember)]",
);

const sectionHeadingClass =
  "font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight";

function formatScalar(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

/** Fraction → percent points (0.1 → "10%"). */
function formatCritPercent(value: number): string {
  const pct = value * 100;
  const fixed = pct.toFixed(4).replace(/\.?0+$/, "");
  return `${fixed}%`;
}

const MODE_OPTIONS: { value: UltraRealmMode; label: string }[] = [
  { value: "ultra", label: "Ultra Realm" },
  { value: "singularity", label: "Singularity Ultra Realm" },
];

export function UltraRealmCalculator() {
  const [state, setState] = useState<StoredState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const baseId = useId();
  const resultsId = useId();
  const modeGroupId = useId();
  const isSingularity = state.mode === "singularity";

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

  function onNumericField(field: "teamMaxHp" | "realmMastery", value: string) {
    if (!isValidNumericInputString(value)) return;
    setState((prev) => ({ ...prev, [field]: value }));
  }

  function onModeChange(mode: UltraRealmMode) {
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

  const result = computeUltraRealmCalculator({
    mode: state.mode,
    teamMaxHp: parseNumericInput(state.teamMaxHp),
    realmMastery: parseNumericInput(state.realmMastery),
    primordiaChaos: state.primordiaChaos,
    pureRealm: state.pureRealm,
    chaosAwakeners: state.chaosAwakeners,
  });

  const showComboRows = result.chaosComboStacks > 0;

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
                    ? "bg-[rgb(120_70_160)] text-[var(--mt-cream,#fff8f0)] shadow-sm"
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
            onChange={(e) => onNumericField("realmMastery", e.target.value)}
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
              }))
            }
            className="size-4 accent-[var(--mt-ember)]"
          />
        </div>

        {!state.primordiaChaos ? (
          <>
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
                    ...(e.target.checked ? {} : { chaosAwakeners: 0 }),
                  }))
                }
                className="size-4 accent-[var(--mt-ember)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor={`${baseId}-chaos`}
                className="min-w-[11rem] text-base text-[var(--mt-ink)]"
              >
                Number of Chaos Awakener:
              </label>
              <select
                id={`${baseId}-chaos`}
                className={selectClassName}
                value={state.chaosAwakeners}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!isChaosCount(n)) return;
                  setState((prev) => ({
                    ...prev,
                    chaosAwakeners: n,
                    ...(n > 0 ? { pureRealm: true } : {}),
                  }));
                }}
              >
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

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
                onChange={(e) => onNumericField("teamMaxHp", e.target.value)}
                className={inputClassName}
                aria-describedby={resultsId}
              />
            </div>
          </>
        ) : null}
      </div>

      <div
        id={resultsId}
        className="space-y-4 text-base text-[var(--mt-ink)]"
      >
        {isSingularity ? (
          <>
            <div className="space-y-2">
              <h3 className="font-[family-name:var(--font-mother-display)] text-xl font-semibold tracking-tight text-[var(--mt-ink)]">
                Singularity Beacon
              </h3>
              <CalculatorStatRow
                label="Base Singularity Beacon:"
                value={formatScalar(result.baseSingularityBeacon)}
              />
              <CalculatorStatRow
                label="Singularity Beacon from RM:"
                value={formatScalar(result.singularityBeaconFromRm)}
              />
              <CalculatorStatRow
                label="Total Singularity Beacon:"
                value={formatScalar(result.totalSingularityBeacon)}
              />
            </div>
            <div className="space-y-2 border-t border-[var(--mt-border)]/40 pt-3">
              <h3 className="font-[family-name:var(--font-mother-display)] text-xl font-semibold tracking-tight text-[var(--mt-ink)]">
                Singularity Prism
              </h3>
              <CalculatorStatRow
                label="Base Singularity Prism:"
                value={formatScalar(result.baseSingularityPrism)}
              />
              <CalculatorStatRow
                label="Singularity Prism from RM:"
                value={formatScalar(result.singularityPrismFromRm)}
              />
              <CalculatorStatRow
                label="Total Singularity Prism:"
                value={formatScalar(result.totalSingularityPrism)}
              />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <CalculatorStatRow
              label="Insight Chance:"
              value={`${formatScalar(result.insightChance)}%`}
            />
          </div>
        )}
        {showComboRows ? (
          <div className="space-y-2 border-t border-[var(--mt-border)]/40 pt-3">
            <h3 className="font-[family-name:var(--font-mother-display)] text-xl font-semibold tracking-tight text-[var(--mt-ink)]">
              Chaos Symbiosis
            </h3>
            <CalculatorStatRow
              label="Enemy STR Down:"
              value={formatScalar(result.enemyStrDown)}
            />
            <CalculatorStatRow
              label="Team STR Up:"
              value={formatScalar(result.teamStrUp)}
            />
            <CalculatorStatRow
              label="Ultra Awakener Crit Damage:"
              value={formatCritPercent(result.ultraAwakenerCritDamage)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
