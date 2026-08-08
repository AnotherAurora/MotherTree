"use client";

import { useEffect, useId, useState } from "react";
import {
  isValidNumericInputString,
  parseNumericInput,
} from "@/components/public/diminishing-return-math";
import { Input } from "@/components/ui/input";
import {
  SOULFORGE_MAX,
  SOULFORGE_MIN,
  applySoulforgeAtk,
} from "@/lib/path-carver/aequor-realm-calculator";
import { baseDeathResistReductionToMaxHpUp } from "@/lib/path-carver/death-resist-trigger";
import { TEAM_SLOT_COUNT } from "@/lib/path-carver/keyflare-harmony";
import {
  computeAwakenerAverageLevel,
  computeBaselineMaxHp,
  computeBonusMaxHpFromMaxHpUp,
  computeEffectiveHpLevel,
} from "@/lib/path-carver/team-max-hp";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mt.calculators.team-max-hp";

const CHAOS_AWAKENER_RAW_DEATH_RESIST_BONUS = 100;

type ConSlotState = {
  con: string;
  soulforge: number;
};

type StoredState = {
  conSlots: ConSlotState[];
  rawDeathResist: string;
  primordiaChaos: boolean;
  chaosAwakenerExist: boolean;
  accountLevel: string;
  awakenerLevels: string[];
};

function emptyConSlots(): ConSlotState[] {
  return Array.from({ length: TEAM_SLOT_COUNT }, () => ({
    con: "0",
    soulforge: 0,
  }));
}

function defaultAwakenerLevels(): string[] {
  return Array.from({ length: TEAM_SLOT_COUNT }, () => "60");
}

function defaultState(): StoredState {
  return {
    conSlots: emptyConSlots(),
    rawDeathResist: "0",
    primordiaChaos: false,
    chaosAwakenerExist: false,
    accountLevel: "60",
    awakenerLevels: defaultAwakenerLevels(),
  };
}

/** Format a percent value; trim trailing zeros after a short fixed precision. */
function formatPercent(value: number): string {
  const fixed = value.toFixed(4).replace(/\.?0+$/, "");
  return `${fixed}%`;
}

function isSoulforge(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= SOULFORGE_MIN &&
    n <= SOULFORGE_MAX
  );
}

function readStored(): StoredState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const o = parsed as Record<string, unknown>;

    if (
      typeof o.accountLevel !== "string" ||
      !isValidNumericInputString(o.accountLevel)
    ) {
      return null;
    }
    const rawDeathResist =
      typeof o.rawDeathResist === "string" &&
      isValidNumericInputString(o.rawDeathResist)
        ? o.rawDeathResist
        : "0";
    if (
      !Array.isArray(o.conSlots) ||
      o.conSlots.length !== TEAM_SLOT_COUNT
    ) {
      return null;
    }
    if (
      !Array.isArray(o.awakenerLevels) ||
      o.awakenerLevels.length !== TEAM_SLOT_COUNT
    ) {
      return null;
    }

    const conSlots: ConSlotState[] = [];
    for (const slot of o.conSlots) {
      if (typeof slot !== "object" || slot === null) return null;
      const s = slot as Record<string, unknown>;
      if (typeof s.con !== "string" || !isValidNumericInputString(s.con)) {
        return null;
      }
      if (!isSoulforge(s.soulforge)) return null;
      conSlots.push({ con: s.con, soulforge: s.soulforge });
    }

    const awakenerLevels: string[] = [];
    for (const level of o.awakenerLevels) {
      if (typeof level !== "string" || !isValidNumericInputString(level)) {
        return null;
      }
      awakenerLevels.push(level);
    }

    const primordiaChaos =
      typeof o.primordiaChaos === "boolean" ? o.primordiaChaos : false;
    const chaosAwakenerExist =
      typeof o.chaosAwakenerExist === "boolean"
        ? o.chaosAwakenerExist
        : false;

    return {
      conSlots,
      rawDeathResist,
      primordiaChaos,
      chaosAwakenerExist: primordiaChaos ? false : chaosAwakenerExist,
      accountLevel: o.accountLevel,
      awakenerLevels,
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

function tryBaselineMaxHp(
  totalCon: number,
  effectiveHpLevel: number,
): number | null {
  try {
    return computeBaselineMaxHp(totalCon, effectiveHpLevel);
  } catch {
    return null;
  }
}

export function TeamMaxHpCalculator() {
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

  function onConChange(slotIndex: number, value: string) {
    if (!isValidNumericInputString(value)) return;
    setState((prev) => ({
      ...prev,
      conSlots: prev.conSlots.map((slot, i) =>
        i === slotIndex ? { ...slot, con: value } : slot,
      ),
    }));
  }

  function onSoulforgeChange(slotIndex: number, value: string) {
    const n = Number(value);
    if (!isSoulforge(n)) return;
    setState((prev) => ({
      ...prev,
      conSlots: prev.conSlots.map((slot, i) =>
        i === slotIndex ? { ...slot, soulforge: n } : slot,
      ),
    }));
  }

  function onRawDeathResistChange(value: string) {
    if (!isValidNumericInputString(value)) return;
    setState((prev) => ({ ...prev, rawDeathResist: value }));
  }

  function onAccountLevelChange(value: string) {
    if (!isValidNumericInputString(value)) return;
    setState((prev) => ({ ...prev, accountLevel: value }));
  }

  function onAwakenerLevelChange(slotIndex: number, value: string) {
    if (!isValidNumericInputString(value)) return;
    setState((prev) => ({
      ...prev,
      awakenerLevels: prev.awakenerLevels.map((level, i) =>
        i === slotIndex ? value : level,
      ),
    }));
  }

  const accountLevel = parseNumericInput(state.accountLevel);
  const awakenerLevelNums = state.awakenerLevels.map((l) =>
    parseNumericInput(l),
  );
  const totalCon = state.conSlots.reduce(
    (sum, slot) =>
      sum + applySoulforgeAtk(parseNumericInput(slot.con), slot.soulforge),
    0,
  );
  const effectiveRawDeathResistPercent =
    parseNumericInput(state.rawDeathResist) +
    (state.chaosAwakenerExist ? CHAOS_AWAKENER_RAW_DEATH_RESIST_BONUS : 0);
  const maxHpUpTotal = baseDeathResistReductionToMaxHpUp(
    effectiveRawDeathResistPercent / 100,
  );
  const maxHpUpPercent = maxHpUpTotal * 100;
  const awakenerAverageLevel =
    computeAwakenerAverageLevel(awakenerLevelNums);
  const effectiveHpLevel = computeEffectiveHpLevel(
    accountLevel,
    awakenerLevelNums,
  );
  const usedAccountLevel = accountLevel > awakenerAverageLevel;
  const baselineMaxHp = tryBaselineMaxHp(totalCon, effectiveHpLevel);
  const bonusMaxHp =
    baselineMaxHp == null
      ? null
      : computeBonusMaxHpFromMaxHpUp(baselineMaxHp, maxHpUpTotal);
  const finalMaxHp =
    baselineMaxHp == null || bonusMaxHp == null
      ? null
      : baselineMaxHp + bonusMaxHp;

  const soulforgeOptions = Array.from(
    { length: SOULFORGE_MAX - SOULFORGE_MIN + 1 },
    (_, i) => SOULFORGE_MIN + i,
  );

  return (
    <div className="space-y-6" aria-live="polite">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start gap-2">
          <span className="min-w-[11rem] pt-2 text-base text-[var(--mt-ink)]">
            Team CON:
          </span>
          <div className="flex flex-wrap items-end gap-1.5">
            {state.conSlots.map((slot, slotIndex) => {
              const conId = `${baseId}-con-${slotIndex}`;
              const sfId = `${baseId}-sf-${slotIndex}`;
              return (
                <div key={slotIndex} className="flex items-end gap-1.5">
                  {slotIndex > 0 ? (
                    <span
                      className="pb-1.5 font-[family-name:var(--font-mother-display)] text-2xl font-semibold text-[var(--mt-ink-muted)]"
                      aria-hidden
                    >
                      +
                    </span>
                  ) : null}
                  <div className="space-y-1">
                    <label
                      htmlFor={conId}
                      className="block text-xs text-[var(--mt-ink-muted)]"
                    >
                      CON {slotIndex + 1}
                    </label>
                    <Input
                      id={conId}
                      inputMode="decimal"
                      autoComplete="off"
                      value={slot.con}
                      onChange={(e) => onConChange(slotIndex, e.target.value)}
                      className={inputClassName}
                      aria-describedby={resultsId}
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor={sfId}
                      className="block text-xs text-[var(--mt-ink-muted)]"
                    >
                      Soulforge
                    </label>
                    <select
                      id={sfId}
                      className={selectClassName}
                      value={slot.soulforge}
                      onChange={(e) =>
                        onSoulforgeChange(slotIndex, e.target.value)
                      }
                    >
                      {soulforgeOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={`${baseId}-raw-dr`}
            className="min-w-[11rem] text-base text-[var(--mt-ink)]"
          >
            Raw Death Resist:
          </label>
          <Input
            id={`${baseId}-raw-dr`}
            inputMode="decimal"
            autoComplete="off"
            value={state.rawDeathResist}
            onChange={(e) => onRawDeathResistChange(e.target.value)}
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
            className="min-w-[11rem] text-base text-[var(--mt-ink)]"
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
                className="min-w-[11rem] text-base text-[var(--mt-ink)]"
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

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={`${baseId}-account-level`}
            className="min-w-[11rem] text-base text-[var(--mt-ink)]"
          >
            Account Level:
          </label>
          <Input
            id={`${baseId}-account-level`}
            inputMode="decimal"
            autoComplete="off"
            value={state.accountLevel}
            onChange={(e) => onAccountLevelChange(e.target.value)}
            className={inputClassName}
            aria-describedby={resultsId}
          />
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <span className="min-w-[11rem] pt-2 text-base text-[var(--mt-ink)]">
            Awakener Levels:
          </span>
          <div className="flex flex-wrap items-end gap-1.5">
            {state.awakenerLevels.map((level, slotIndex) => {
              const levelId = `${baseId}-aw-level-${slotIndex}`;
              return (
                <div key={slotIndex} className="space-y-1">
                  <label
                    htmlFor={levelId}
                    className="block text-xs text-[var(--mt-ink-muted)]"
                  >
                    Level {slotIndex + 1}
                  </label>
                  <Input
                    id={levelId}
                    inputMode="decimal"
                    autoComplete="off"
                    value={level}
                    onChange={(e) =>
                      onAwakenerLevelChange(slotIndex, e.target.value)
                    }
                    className={inputClassName}
                    aria-describedby={resultsId}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        id={resultsId}
        className="space-y-1 text-base text-[var(--mt-ink)]"
      >
        <p>
          Awakener Average Level:{" "}
          <span className="font-semibold tabular-nums">
            {awakenerAverageLevel}
          </span>
        </p>
        <p>
          Effective HP Level:{" "}
          <span className="font-semibold tabular-nums">{effectiveHpLevel}</span>
          <span className="text-[var(--mt-ink-muted)]">
            {" "}
            (
            {usedAccountLevel
              ? "Using Account Level"
              : "Using blend (Account + Awakener Average)"}
            )
          </span>
        </p>
        <p>
          Max HP increase:{" "}
          <span className="font-semibold tabular-nums">
            {formatPercent(maxHpUpPercent)}
          </span>
        </p>
        <p>
          Team Max HP:{" "}
          <span className="font-semibold tabular-nums">
            {finalMaxHp == null ? "—" : finalMaxHp}
          </span>
        </p>
      </div>
    </div>
  );
}
