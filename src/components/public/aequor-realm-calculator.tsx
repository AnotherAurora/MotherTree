"use client";

import {
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
} from "react";
import {
  isValidNumericInputString,
  parseNumericInput,
} from "@/components/public/diminishing-return-math";
import { Input } from "@/components/ui/input";
import {
  SOULFORGE_MAX,
  SOULFORGE_MIN,
  computeAequorRealmCalculator,
  type AequorRealmMode,
} from "@/lib/path-carver/aequor-realm-calculator";
import { TEAM_SLOT_COUNT } from "@/lib/path-carver/keyflare-harmony";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mt.calculators.aequor-realm";

type AtkSlotState = {
  atk: string;
  soulforge: number;
};

type StoredState = {
  mode: AequorRealmMode;
  teamMaxHp: string;
  atkSlots: AtkSlotState[];
  damageAmp: string;
  realmMastery: string;
  accountLevel: string;
  primordiaChaos: boolean;
  pureRealm: boolean;
  chaosAwakeners: number;
};

function emptyAtkSlots(): AtkSlotState[] {
  return Array.from({ length: TEAM_SLOT_COUNT }, () => ({
    atk: "0",
    soulforge: 0,
  }));
}

function defaultState(): StoredState {
  return {
    mode: "aequor",
    teamMaxHp: "0",
    atkSlots: emptyAtkSlots(),
    damageAmp: "0",
    realmMastery: "0",
    accountLevel: "60",
    primordiaChaos: false,
    pureRealm: false,
    chaosAwakeners: 0,
  };
}

function isSoulforge(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= SOULFORGE_MIN &&
    n <= SOULFORGE_MAX
  );
}

function isChaosCount(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 3;
}

function isRealmMode(v: unknown): v is AequorRealmMode {
  return v === "aequor" || v === "benthos";
}

function readStored(): StoredState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const o = parsed as Record<string, unknown>;

    if (
      typeof o.teamMaxHp !== "string" ||
      !isValidNumericInputString(o.teamMaxHp)
    ) {
      return null;
    }
    if (
      typeof o.damageAmp !== "string" ||
      !isValidNumericInputString(o.damageAmp)
    ) {
      return null;
    }
    if (
      typeof o.realmMastery !== "string" ||
      !isValidNumericInputString(o.realmMastery)
    ) {
      return null;
    }
    if (
      typeof o.accountLevel !== "string" ||
      !isValidNumericInputString(o.accountLevel)
    ) {
      return null;
    }
    if (typeof o.primordiaChaos !== "boolean") return null;
    if (typeof o.pureRealm !== "boolean") return null;
    if (!isChaosCount(o.chaosAwakeners)) return null;
    if (!Array.isArray(o.atkSlots) || o.atkSlots.length !== TEAM_SLOT_COUNT) {
      return null;
    }

    const atkSlots: AtkSlotState[] = [];
    for (const slot of o.atkSlots) {
      if (typeof slot !== "object" || slot === null) return null;
      const s = slot as Record<string, unknown>;
      if (typeof s.atk !== "string" || !isValidNumericInputString(s.atk)) {
        return null;
      }
      if (!isSoulforge(s.soulforge)) return null;
      atkSlots.push({ atk: s.atk, soulforge: s.soulforge });
    }

    const mode = isRealmMode(o.mode) ? o.mode : "aequor";

    return {
      mode,
      teamMaxHp: o.teamMaxHp,
      atkSlots,
      damageAmp: o.damageAmp,
      realmMastery: o.realmMastery,
      accountLevel: o.accountLevel,
      primordiaChaos: o.primordiaChaos,
      pureRealm: o.pureRealm,
      chaosAwakeners: o.chaosAwakeners,
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

const wideInputClassName = cn(
  "h-10 max-w-[10rem] border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] text-[var(--mt-ink)] shadow-none tabular-nums",
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

/** Fraction → percent points for Attack% rows (0.04 → "4%"). */
function formatAttackPercent(value: number): string {
  const pct = value * 100;
  const fixed = pct.toFixed(4).replace(/\.?0+$/, "");
  return `${fixed}%`;
}

const MODE_OPTIONS: { value: AequorRealmMode; label: string }[] = [
  { value: "aequor", label: "Aequor Realm" },
  { value: "benthos", label: "Benthos Aequor Realm" },
];

export function AequorRealmCalculator() {
  const [state, setState] = useState<StoredState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const baseId = useId();
  const resultsId = useId();
  const modeGroupId = useId();
  const isBenthos = state.mode === "benthos";

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

  function onNumericField(
    field: "teamMaxHp" | "damageAmp" | "realmMastery" | "accountLevel",
    value: string,
  ) {
    if (!isValidNumericInputString(value)) return;
    setState((prev) => ({ ...prev, [field]: value }));
  }

  function onAtkChange(slotIndex: number, value: string) {
    if (!isValidNumericInputString(value)) return;
    setState((prev) => ({
      ...prev,
      atkSlots: prev.atkSlots.map((slot, i) =>
        i === slotIndex ? { ...slot, atk: value } : slot,
      ),
    }));
  }

  function onSoulforgeChange(slotIndex: number, value: string) {
    const n = Number(value);
    if (!isSoulforge(n)) return;
    setState((prev) => ({
      ...prev,
      atkSlots: prev.atkSlots.map((slot, i) =>
        i === slotIndex ? { ...slot, soulforge: n } : slot,
      ),
    }));
  }

  function onModeChange(mode: AequorRealmMode) {
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

  const result = computeAequorRealmCalculator({
    mode: state.mode,
    teamMaxHp: parseNumericInput(state.teamMaxHp),
    atkSlots: state.atkSlots.map((s) => ({
      atk: parseNumericInput(s.atk),
      soulforge: s.soulforge,
    })),
    damageAmpTotal: parseNumericInput(state.damageAmp) / 100,
    realmMastery: parseNumericInput(state.realmMastery),
    accountLevel: parseNumericInput(state.accountLevel),
    primordiaChaos: state.primordiaChaos,
    pureRealm: state.pureRealm,
    chaosAwakeners: state.chaosAwakeners,
  });

  const soulforgeOptions = Array.from(
    { length: SOULFORGE_MAX - SOULFORGE_MIN + 1 },
    (_, i) => SOULFORGE_MIN + i,
  );

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
                    ? "bg-[rgb(47_110_168)] text-[var(--mt-cream,#fff8f0)] shadow-sm"
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
            onChange={(e) => onNumericField("teamMaxHp", e.target.value)}
            className={wideInputClassName}
            aria-describedby={resultsId}
          />
        </div>

        {!isBenthos ? (
          <div className="flex flex-wrap items-start gap-2">
            <span className="min-w-[11rem] pt-2 text-base text-[var(--mt-ink)]">
              Team ATK:
            </span>
            <div className="flex flex-wrap items-end gap-1.5">
              {state.atkSlots.map((slot, slotIndex) => {
                const atkId = `${baseId}-atk-${slotIndex}`;
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
                        htmlFor={atkId}
                        className="block text-xs text-[var(--mt-ink-muted)]"
                      >
                        ATK {slotIndex + 1}
                      </label>
                      <Input
                        id={atkId}
                        inputMode="decimal"
                        autoComplete="off"
                        value={slot.atk}
                        onChange={(e) => onAtkChange(slotIndex, e.target.value)}
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
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={`${baseId}-amp`}
            className="min-w-[11rem] text-base text-[var(--mt-ink)]"
          >
            Damage AMP:
          </label>
          <Input
            id={`${baseId}-amp`}
            inputMode="decimal"
            autoComplete="off"
            value={state.damageAmp}
            onChange={(e) => onNumericField("damageAmp", e.target.value)}
            className={wideInputClassName}
            aria-describedby={resultsId}
          />
          <span className="text-base text-[var(--mt-ink)]" aria-hidden>
            %
          </span>
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
            onChange={(e) => onNumericField("realmMastery", e.target.value)}
            className={wideInputClassName}
            aria-describedby={resultsId}
          />
        </div>

        {!isBenthos ? (
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={`${baseId}-level`}
              className="min-w-[11rem] text-base text-[var(--mt-ink)]"
            >
              Account Level:
            </label>
            <Input
              id={`${baseId}-level`}
              inputMode="decimal"
              autoComplete="off"
              value={state.accountLevel}
              onChange={(e) => onNumericField("accountLevel", e.target.value)}
              className={wideInputClassName}
              aria-describedby={resultsId}
            />
          </div>
        ) : null}

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
                  }))
                }
                className="size-4 accent-[var(--mt-ember)]"
              />
            </div>

            <div className="space-y-1.5">
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
                    setState((prev) => ({ ...prev, chaosAwakeners: n }));
                  }}
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <p className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--mt-ink-muted)]">
                <span>
                  *Miryam SF has an effect on Chaos tentacle damage bonus and I
                  won&apos;t calculate it. Just add a few points to tentacle damage yourself.
                </span>
                <span className="inline-flex size-8 shrink-0 overflow-hidden rounded-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/emotes/Saya_Sleep.webp"
                    alt=""
                    width={32}
                    height={32}
                    className="size-full scale-150 object-cover object-center"
                  />
                </span>
              </p>
            </div>
          </>
        ) : null}
      </div>

      <div
        id={resultsId}
        className="space-y-4 text-base text-[var(--mt-ink)]"
      >
        <div className="space-y-1">
          <h3 className="font-[family-name:var(--font-mother-display)] text-xl font-semibold tracking-tight text-[var(--mt-ink)]">
            Base Tentacle
          </h3>
          <p>
            Base Tentacle Damage:{" "}
            <span className="font-semibold tabular-nums">
              {formatScalar(result.tentacle.valueScalar)}
            </span>
          </p>
          <p>
            Base Red Tentacle Damage:{" "}
            <span className="font-semibold tabular-nums">
              {formatScalar(result.baseRedTentacleDamage)}
            </span>
          </p>
          {isBenthos ? (
            <>
              <p>
                Red Tentacle Damage from RM:{" "}
                <span className="font-semibold tabular-nums">
                  {formatScalar(result.redTentacleDamageFromRm)}
                </span>
              </p>
              <p>
                Total Red Tentacle Damage:{" "}
                <span className="font-semibold tabular-nums">
                  {formatScalar(result.totalRedTentacleDamage)}
                </span>
              </p>
            </>
          ) : null}
        </div>

        <div className="space-y-1">
          <h3 className="font-[family-name:var(--font-mother-display)] text-xl font-semibold tracking-tight text-[var(--mt-ink)]">
            White Tentacle
          </h3>
          <p>
            Base White Tentacle Shield:{" "}
            <span className="font-semibold tabular-nums">
              {formatScalar(result.baseWhiteTentacleShield)}
            </span>
          </p>
          <p>
            White Tentacle Shield from RM:{" "}
            <span className="font-semibold tabular-nums">
              {formatScalar(result.whiteTentacleShieldFromRm)}
            </span>
          </p>
          <p>
            Total White Tentacle Shield:{" "}
            <span className="font-semibold tabular-nums">
              {formatScalar(result.totalWhiteTentacleShield)}
            </span>
          </p>
        </div>

        <div className="space-y-1">
          <h3 className="font-[family-name:var(--font-mother-display)] text-xl font-semibold tracking-tight text-[var(--mt-ink)]">
            Red Tentacle
          </h3>
          <p>
            Base Red Tentacle Attack%:{" "}
            <span className="font-semibold tabular-nums">
              {formatAttackPercent(result.baseRedTentacleAttack)}
            </span>
          </p>
          {!isBenthos ? (
            <>
              <p>
                Red Tentacle Attack% from RM:{" "}
                <span className="font-semibold tabular-nums">
                  {formatAttackPercent(result.redTentacleAttackFromRm)}
                </span>
              </p>
              <p>
                Total Tentacle Attack%:{" "}
                <span className="font-semibold tabular-nums">
                  {formatAttackPercent(result.totalRedTentacleAttack)}
                </span>
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
