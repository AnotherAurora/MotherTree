"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ForeignKeyCombobox } from "@/components/admin/foreign-key-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildAwakenerOptionMap,
  filterAwakenerOptionsForSlot,
} from "@/components/simulator/awakener-selection";
import type { SlotState } from "@/components/simulator/mock-data";
import type { ForeignKeyOption } from "@/lib/actions/crud";
import type { SimulatorAwakenerOption } from "@/lib/actions/simulator";
import { AssetIcon } from "@/lib/assets/asset-icon";
import { resolveSkeydbAssetUrl } from "@/lib/assets/resolve-asset-url";
import {
  DEFAULT_AWAKENER_ENLIGHTENMENT,
  AWAKENER_ENLIGHTENMENT_OPTIONS,
} from "@/lib/enlightenment-options";
import type { AnchoredAwakenerState } from "@/lib/path-carver/types";
import { validateBuildStep } from "@/lib/path-carver/validation";
import {
  buildCovenantOptionMap,
  buildWheelOptionMap,
  filterCovenantOptionsForSlot,
  filterWheelOptionsForSlot,
} from "@/lib/simulator/gear-selection";
import type { SimulatorGearOptions } from "@/lib/simulator/types";

type RelicTeamBuilderProps = {
  slots: SlotState[];
  anchoredAwakeners: AnchoredAwakenerState[];
  awakenerOptions: SimulatorAwakenerOption[];
  gearOptions: SimulatorGearOptions;
  posseId: number | null;
  onSlotsChange: (slots: SlotState[]) => void;
  onAnchoredChange: (anchors: AnchoredAwakenerState[]) => void;
  onPosseChange: (posseId: number | null) => void;
  accountLevelText: string;
  onAccountLevelTextChange: (value: string) => void;
  onCommitAccountLevel: () => void;
  ownedPosseText: string;
  onOwnedPosseTextChange: (value: string) => void;
  onCommitOwnedPosseCount: () => void;
  hsr: boolean;
  onHsrChange: (value: boolean) => void;
  importing: boolean;
  onImportOpen: () => void;
};

function EmptyArt() {
  return (
    <span className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#eed9bf] to-[#d8b993]">
      <svg
        width="88"
        height="88"
        viewBox="0 0 88 88"
        aria-hidden="true"
        className="text-[var(--mt-ink-muted)] opacity-40"
      >
        <rect
          x="26"
          y="26"
          width="36"
          height="36"
          transform="rotate(45 44 44)"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M44 34v20M34 44h20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function AwakenerCardArt({ name }: { name: string }) {
  const cardSrc = resolveSkeydbAssetUrl("awakener", name, "card");
  const portraitSrc = resolveSkeydbAssetUrl("awakener", name);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const src =
    cardSrc && failedSrc !== cardSrc
      ? cardSrc
      : portraitSrc && failedSrc !== portraitSrc
        ? portraitSrc
        : undefined;

  if (!src) return <EmptyArt />;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote hotlink; fall back on error
    <img
      src={src}
      alt={name}
      className="h-full w-full object-cover object-top"
      onError={() => setFailedSrc(src)}
    />
  );
}

function WheelTile({
  value,
  options,
  onChange,
}: {
  value: number | null;
  options: ForeignKeyOption[];
  onChange: (value: number | null) => void;
}) {
  const selected = options.find((option) => option.value === value);
  const src = selected
    ? resolveSkeydbAssetUrl("wheel", selected.assetName ?? selected.label, "icon")
    : undefined;

  return (
    <ForeignKeyCombobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Wheel"
      assetKind="wheel"
      trigger={
        <button
          type="button"
          title={selected?.label ?? "Select wheel"}
          aria-label={selected ? `Change wheel ${selected.label}` : "Select wheel"}
          className="flex aspect-[75/113] w-[86%] cursor-pointer items-center justify-center overflow-hidden rounded-md border border-[rgb(42_28_22_/_0.5)] bg-[rgb(42_28_22_/_0.4)] p-px shadow-[0_2px_6px_rgb(0_0_0_/_0.35)] transition-colors hover:border-[var(--mt-ember)]/60"
        >
          {src ? (
            <AssetIcon
              src={src}
              alt={selected?.label ?? ""}
              size={96}
              className="h-full w-full scale-[1.2] rounded-none object-cover"
            />
          ) : (
            <span className="text-lg text-white/60">+</span>
          )}
        </button>
      }
    />
  );
}

function CovenantPicker({
  value,
  options,
  onChange,
}: {
  value: number | null;
  options: ForeignKeyOption[];
  onChange: (value: number | null) => void;
}) {
  const selected = options.find((option) => option.value === value);
  const src = selected
    ? resolveSkeydbAssetUrl("covenant", selected.assetName ?? selected.label)
    : undefined;

  return (
    <ForeignKeyCombobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Covenant"
      assetKind="covenant"
      trigger={
        <button
          type="button"
          title={selected?.label ?? "Select covenant"}
          aria-label={
            selected ? `Change covenant ${selected.label}` : "Select covenant"
          }
          className="flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-[rgb(42_28_22_/_0.55)] bg-[rgb(42_28_22_/_0.45)] shadow-[0_2px_8px_rgb(0_0_0_/_0.4)] transition-colors hover:border-[var(--mt-ember)]/70"
        >
          {src ? (
            <AssetIcon
              src={src}
              alt={selected?.label ?? ""}
              size={72}
              className="h-full w-full scale-[1.65] rounded-none object-cover"
            />
          ) : (
            <span className="text-lg text-white/60">+</span>
          )}
        </button>
      }
    />
  );
}

function RelicAwakenerCard({
  slot,
  awakenerOptions,
  covenantOptions,
  wheel1Options,
  wheel2Options,
  awakenerLabel,
  isDamageDealer,
  onChange,
  onDamageDealerChange,
}: {
  slot: SlotState;
  awakenerOptions: ForeignKeyOption[];
  covenantOptions: ForeignKeyOption[];
  wheel1Options: ForeignKeyOption[];
  wheel2Options: ForeignKeyOption[];
  awakenerLabel: string | null;
  isDamageDealer: boolean;
  onChange: (slot: SlotState) => void;
  onDamageDealerChange: (value: boolean) => void;
}) {
  const hasAwakener = slot.awakenerId != null;
  const enlightenment =
    slot.awakenerEnlightenment ?? DEFAULT_AWAKENER_ENLIGHTENMENT;

  return (
    <div
      className="relative aspect-[25/56] overflow-hidden rounded-xl border border-[var(--mt-border)] shadow-[0_6px_18px_rgb(42_28_22_/_0.22)]"
      style={{ containerType: "inline-size" }}
    >
      <ForeignKeyCombobox
        value={slot.awakenerId}
        onChange={(awakenerId) => onChange({ ...slot, awakenerId })}
        options={awakenerOptions}
        placeholder="Select awakener..."
        assetKind="awakener"
        trigger={
          <button
            type="button"
            aria-label={
              awakenerLabel ? `Change ${awakenerLabel}` : "Select awakener"
            }
            className="absolute inset-0 z-0 block cursor-pointer"
          >
            {hasAwakener && awakenerLabel ? (
              <AwakenerCardArt name={awakenerLabel} />
            ) : (
              <EmptyArt />
            )}
          </button>
        }
      />

      {hasAwakener && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {/* Bottom shade, ported from SKeyDB `.builder-card-bottom-shade`. */}
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(1,5,12,0.95)_0%,rgba(1,5,12,0.9)_14%,rgba(1,5,12,0.85)_24%,rgba(1,5,12,0.45)_35%,rgba(1,5,12,0)_45%)]" />

          {/* Name plate, ported from SKeyDB `.builder-card-name-wrap`. */}
          <div className="absolute inset-x-0 top-0 z-20 bg-[linear-gradient(180deg,rgba(8,15,28,0.8)_0%,rgba(8,15,28,0.5)_50%,rgba(8,15,28,0.22)_78%,rgba(8,15,28,0)_100%)] px-2 pb-[18%] pt-1">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 truncate font-[family-name:var(--font-mother-display)] text-base font-bold leading-[1.02] text-white/95 [text-shadow:0_1px_2px_rgba(2,6,12,0.75)]">
                {awakenerLabel}
              </p>
              <label
                className="pointer-events-auto flex shrink-0 cursor-pointer items-center gap-1 rounded-md bg-black/55 px-1.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-white/90 backdrop-blur-sm"
                title="Damage Dealer"
              >
                <input
                  type="checkbox"
                  checked={isDamageDealer}
                  onChange={(event) =>
                    onDamageDealerChange(event.target.checked)
                  }
                  className="size-4 shrink-0 cursor-pointer rounded border-white/40 accent-[var(--mt-ember)] [color-scheme:dark]"
                />
                DD
              </label>
            </div>
          </div>

          {/* Card meta + wheels, ported from SKeyDB `.builder-card-wheel-zone`. */}
          <div className="absolute inset-x-0 bottom-0 z-20 p-2">
            <div className="flex items-end gap-2 pb-2">
              <div className="min-w-0 flex-1 pb-1">
                <p className="mb-0.5 inline-flex items-baseline justify-start gap-[0.02em] font-[family-name:var(--font-mother-display)] text-[clamp(20px,6.3cqw,60px)] font-bold leading-none text-white/90 [text-shadow:0_1px_2px_rgba(2,6,12,0.75)]">
                  <span className="text-[0.72em]">Lv.</span>
                  <span>60</span>
                </p>
                <div className="pointer-events-auto relative mt-1 block w-fit">
                  <select
                    aria-label="Awakener enlightenment"
                    value={enlightenment}
                    onChange={(event) =>
                      onChange({
                        ...slot,
                        awakenerEnlightenment: Number(event.target.value),
                      })
                    }
                    className="cursor-pointer appearance-none rounded-md border border-white/25 bg-black/60 py-0.5 pl-2 pr-6 text-[0.8rem] font-semibold text-white outline-none backdrop-blur-sm transition-colors hover:border-[var(--mt-ember)]/70"
                  >
                    {AWAKENER_ENLIGHTENMENT_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className="bg-[#2a1c16] text-white"
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-white/70"
                  />
                </div>
              </div>

              <div className="pointer-events-auto w-[30%] shrink-0 self-end">
                <CovenantPicker
                  value={slot.covenantId}
                  options={covenantOptions}
                  onChange={(covenantId) => onChange({ ...slot, covenantId })}
                />
              </div>
            </div>

            <div className="pointer-events-auto mt-1.5 grid grid-cols-2 justify-items-center gap-1.5">
              <WheelTile
                value={slot.wheel1Id}
                options={wheel1Options}
                onChange={(wheel1Id) => onChange({ ...slot, wheel1Id })}
              />
              <WheelTile
                value={slot.wheel2Id}
                options={wheel2Options}
                onChange={(wheel2Id) => onChange({ ...slot, wheel2Id })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RelicTeamBuilder({
  slots,
  anchoredAwakeners,
  awakenerOptions,
  gearOptions,
  posseId,
  onSlotsChange,
  onAnchoredChange,
  onPosseChange,
  accountLevelText,
  onAccountLevelTextChange,
  onCommitAccountLevel,
  ownedPosseText,
  onOwnedPosseTextChange,
  onCommitOwnedPosseCount,
  hsr,
  onHsrChange,
  importing,
  onImportOpen,
}: RelicTeamBuilderProps) {
  const optionMap = useMemo(
    () => buildAwakenerOptionMap(awakenerOptions),
    [awakenerOptions],
  );

  const filteredOptionsBySlot = useMemo(
    () =>
      slots.map((_, index) =>
        filterAwakenerOptionsForSlot(
          awakenerOptions,
          slots,
          index,
          optionMap,
        ),
      ),
    [awakenerOptions, slots, optionMap],
  );

  const covenantMap = useMemo(
    () => buildCovenantOptionMap(gearOptions.covenant),
    [gearOptions.covenant],
  );

  const wheelMap = useMemo(
    () => buildWheelOptionMap(gearOptions.wheel),
    [gearOptions.wheel],
  );

  const filteredCovenantBySlot = useMemo(
    () =>
      slots.map((_, index) =>
        filterCovenantOptionsForSlot(
          gearOptions.covenant,
          slots,
          index,
          covenantMap,
        ),
      ),
    [gearOptions.covenant, slots, covenantMap],
  );

  const filteredWheel1BySlot = useMemo(
    () =>
      slots.map((_, index) =>
        filterWheelOptionsForSlot(
          gearOptions.wheel,
          slots,
          index,
          "wheel1Id",
          wheelMap,
        ),
      ),
    [gearOptions.wheel, slots, wheelMap],
  );

  const filteredWheel2BySlot = useMemo(
    () =>
      slots.map((_, index) =>
        filterWheelOptionsForSlot(
          gearOptions.wheel,
          slots,
          index,
          "wheel2Id",
          wheelMap,
        ),
      ),
    [gearOptions.wheel, slots, wheelMap],
  );

  const validation = useMemo(
    () =>
      validateBuildStep(
        slots,
        anchoredAwakeners,
        optionMap,
        covenantMap,
        wheelMap,
      ),
    [slots, anchoredAwakeners, optionMap, covenantMap, wheelMap],
  );

  function updateSlot(index: number, slot: SlotState) {
    const prev = slots[index];
    const next = [...slots];
    next[index] = slot;
    onSlotsChange(next);

    if (prev?.awakenerId != null && prev.awakenerId !== slot.awakenerId) {
      onAnchoredChange(
        anchoredAwakeners.filter((a) => a.awakenerId !== prev.awakenerId),
      );
    }
  }

  function setDamageDealer(index: number, enabled: boolean) {
    const awakenerId = slots[index]?.awakenerId;
    if (awakenerId == null) return;

    const withoutCurrent = anchoredAwakeners.filter(
      (a) => a.awakenerId !== awakenerId,
    );

    onAnchoredChange(
      enabled
        ? [...withoutCurrent, { awakenerId, isDamageDealer: true }]
        : withoutCurrent,
    );
  }

  const selectedPosse = gearOptions.posse.find(
    (option) => option.value === posseId,
  );
  const posseSrc = selectedPosse
    ? resolveSkeydbAssetUrl(
        "posse",
        selectedPosse.assetName ?? selectedPosse.label,
      )
    : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-[var(--mt-border)] bg-[var(--mt-surface)] p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label
              htmlFor="account-level"
              className="text-xs font-medium uppercase tracking-wide text-[var(--mt-ink-muted)]"
            >
              Account Level (1–100)
            </Label>
            <Input
              id="account-level"
              type="number"
              min={1}
              max={100}
              autoComplete="off"
              value={accountLevelText}
              onChange={(event) => onAccountLevelTextChange(event.target.value)}
              onBlur={onCommitAccountLevel}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="w-32"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="owned-posse"
              className="text-xs font-medium uppercase tracking-wide text-[var(--mt-ink-muted)]"
            >
              Owned Posse (1–50)
            </Label>
            <Input
              id="owned-posse"
              type="number"
              min={1}
              max={50}
              autoComplete="off"
              value={ownedPosseText}
              onChange={(event) => onOwnedPosseTextChange(event.target.value)}
              onBlur={onCommitOwnedPosseCount}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="w-32"
            />
          </div>

          <div className="flex items-center gap-3 pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--mt-ink)]">
              <input
                type="checkbox"
                checked={hsr}
                onChange={(event) => onHsrChange(event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              HSR (double relic values)
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={onImportOpen}
              disabled={importing}
            >
              Import
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-[var(--mt-ink-muted)]">
            Posse
          </Label>
          <ForeignKeyCombobox
            value={posseId}
            onChange={onPosseChange}
            options={gearOptions.posse}
            placeholder="Select posse..."
            assetKind="posse"
            trigger={
              <button
                type="button"
                title={selectedPosse?.label ?? "Select posse"}
                aria-label={
                  selectedPosse
                    ? `Change posse ${selectedPosse.label}`
                    : "Select posse"
                }
                className="flex min-w-[12rem] cursor-pointer items-center gap-2 rounded-md border border-[var(--mt-border)] bg-white/90 px-2 py-1.5 text-left transition-colors hover:border-[var(--mt-ember)]/50"
              >
                {posseSrc ? (
                  <AssetIcon
                    src={posseSrc}
                    alt={selectedPosse?.label ?? ""}
                    size={32}
                    darkChip
                  />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-sm bg-[rgb(42_28_22_/_0.35)] text-white/60">
                    +
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--mt-ink)]">
                  {selectedPosse?.label ?? "Not Set"}
                </span>
              </button>
            }
          />
        </div>
      </div>

      {!validation.valid && validation.errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Fix team constraints before continuing:</p>
          <ul className="mt-1 list-inside list-disc">
            {validation.errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 lg:grid-cols-4">
        {slots.map((slot, index) => (
          <RelicAwakenerCard
            key={index}
            slot={slot}
            awakenerOptions={filteredOptionsBySlot[index] ?? []}
            covenantOptions={filteredCovenantBySlot[index] ?? []}
            wheel1Options={filteredWheel1BySlot[index] ?? []}
            wheel2Options={filteredWheel2BySlot[index] ?? []}
            awakenerLabel={
              slot.awakenerId != null
                ? (optionMap.get(slot.awakenerId)?.label ?? null)
                : null
            }
            isDamageDealer={anchoredAwakeners.some(
              (a) => a.awakenerId === slot.awakenerId && a.isDamageDealer,
            )}
            onChange={(updated) => updateSlot(index, updated)}
            onDamageDealerChange={(value) => setDamageDealer(index, value)}
          />
        ))}
      </div>
    </div>
  );
}
