"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { RelicTeamBuilder } from "@/components/relic-picker/relic-team-builder";
import { useRelicRanking } from "@/components/relic-picker/use-relic-ranking";
import { ImportTeamModal } from "@/components/path-carver/import-team-modal";
import { CalculatorPendingHydration } from "@/components/public/calculator-pending-hydration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssetIcon } from "@/lib/assets/asset-icon";
import { resolveSkeydbAssetUrl } from "@/lib/assets/resolve-asset-url";
import { resolveSkeydbRelicUrl } from "@/lib/assets/skeydb-relic-link";
import {
  importTeamCodePublic,
  loadPublicRelicPickerTeamData,
} from "@/lib/actions/public-relic-picker";
import {
  clampAccountLevel,
  DEFAULT_ACCOUNT_LEVEL,
  DEFAULT_OWNED_POSSE_COUNT,
} from "@/lib/path-carver/relic-research-curve";
import type { RelicRankingRow } from "@/lib/path-carver/relic-candidates";
import type { RelicCatalogEntry } from "@/lib/path-carver/relic-manifestations";
import { resolveRelicTooltipRows } from "@/lib/path-carver/relic-tooltip";
import type { AnchoredAwakenerState } from "@/lib/path-carver/types";
import { formatSearchTagLabel } from "@/lib/public/search-filter-options";
import type { PublicAwakenerOption } from "@/lib/public/relic-picker-data";
import { createEmptySlots } from "@/lib/simulator/types";
import type { SimulatorGearOptions, SlotState } from "@/lib/simulator/types";
import type { TeamData } from "@/lib/team-data/types";
import type { ImportTeamResult } from "@/lib/team-import";
import { formatIngameImportWarningMessage } from "@/lib/team-import";

type RelicPickerProps = {
  awakenerOptions: PublicAwakenerOption[];
  gearOptions: SimulatorGearOptions;
};

type SelectedRelic = {
  relicId: number;
  name: string;
  tier: string;
};

type RelicCardMeta = {
  /** Multi-line `value tag` text for the native tooltip. */
  tooltip: string;
  skeydbUrl?: string;
};

const MIN_OWNED_POSSE_COUNT = 1;
const MAX_OWNED_POSSE_COUNT = 50;

const MIN_NEGLIGIBLE_PERCENT = 0;
const MAX_NEGLIGIBLE_PERCENT = 100;
const DEFAULT_NEGLIGIBLE_PERCENT = 1;

const subscribeNoop = () => () => {};

function clampOwnedPosseCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_OWNED_POSSE_COUNT;
  return Math.max(
    MIN_OWNED_POSSE_COUNT,
    Math.min(MAX_OWNED_POSSE_COUNT, Math.floor(value)),
  );
}

function clampNegligiblePercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_NEGLIGIBLE_PERCENT;
  return Math.max(
    MIN_NEGLIGIBLE_PERCENT,
    Math.min(MAX_NEGLIGIBLE_PERCENT, value),
  );
}

const RESEARCH_INPUTS_STORAGE_KEY = "mt.relic-picker.inputs";

type StoredResearchInputs = {
  accountLevel: number;
  ownedPosseCount: number;
  autoUpdate: boolean;
  negligiblePercent: number;
};

function readStoredResearchInputs(): StoredResearchInputs | null {
  try {
    const raw = window.localStorage.getItem(RESEARCH_INPUTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const o = parsed as Record<string, unknown>;
    const accountLevel =
      typeof o.accountLevel === "number" && Number.isFinite(o.accountLevel)
        ? clampAccountLevel(o.accountLevel)
        : DEFAULT_ACCOUNT_LEVEL;
    const ownedPosseCount =
      typeof o.ownedPosseCount === "number" &&
      Number.isFinite(o.ownedPosseCount)
        ? clampOwnedPosseCount(o.ownedPosseCount)
        : DEFAULT_OWNED_POSSE_COUNT;
    const autoUpdate = typeof o.autoUpdate === "boolean" ? o.autoUpdate : true;
    const negligiblePercent =
      typeof o.negligiblePercent === "number" &&
      Number.isFinite(o.negligiblePercent)
        ? clampNegligiblePercent(o.negligiblePercent)
        : DEFAULT_NEGLIGIBLE_PERCENT;
    return { accountLevel, ownedPosseCount, autoUpdate, negligiblePercent };
  } catch {
    return null;
  }
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  if (!Number.isFinite(value)) return "∞";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatTotal(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Mirrors the Search page formatter (`formatValueDisplay` in
 * `src/lib/public/search-results.ts`): percent rows store a fraction, so scale
 * to percent points and trim float noise.
 */
function formatTooltipValue(value: number, isPercent: boolean): string {
  if (!isPercent) return String(value);
  const pct = Math.round(value * 100 * 1e10) / 1e10;
  return `${pct}%`;
}

/** A ranked relic card: optional percent label above a clickable icon. */
function RankedRelicButton({
  entry,
  meta,
  disabled,
  showPercent,
  percentIncrease,
  widthClass,
  onAdd,
}: {
  entry: RelicCatalogEntry;
  meta: RelicCardMeta | undefined;
  disabled: boolean;
  showPercent: boolean;
  percentIncrease: number | null;
  widthClass: string;
  onAdd: (entry: RelicCatalogEntry) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAdd(entry)}
      disabled={disabled}
      title={meta?.tooltip ?? `Add ${entry.name}`}
      aria-label={`Add ${entry.name}`}
      onContextMenu={(event) => {
        if (!meta?.skeydbUrl) return;
        event.preventDefault();
        window.open(meta.skeydbUrl, "_blank", "noopener,noreferrer");
      }}
      className={`flex ${widthClass} cursor-pointer flex-col items-center gap-1 rounded-md border border-transparent p-1 hover:border-[var(--mt-border)] hover:bg-[rgb(255_245_235_/_0.4)] focus-visible:border-[var(--mt-border)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {showPercent && (
        <span className="text-xs font-medium tabular-nums text-[var(--mt-ember-deep)]">
          {formatPercent(percentIncrease)}
        </span>
      )}
      <span className="flex size-14 items-center justify-center overflow-hidden rounded-md">
        <AssetIcon
          src={resolveSkeydbAssetUrl("relic", entry.name)}
          alt={entry.name}
          size={54}
          className="scale-[1.15] rounded-none object-cover"
        />
      </span>
    </button>
  );
}

/** Ranked cards sharing one resolved effect, flattened into a display group. */
type DisplayRelicGroup = {
  representativeId: number;
  percentIncrease: number | null;
  members: RelicRankingRow[];
};

export function RelicPicker({
  awakenerOptions,
  gearOptions,
}: RelicPickerProps) {
  const [slots, setSlots] = useState<SlotState[]>(() => createEmptySlots());
  const [anchoredAwakeners, setAnchoredAwakeners] = useState<
    AnchoredAwakenerState[]
  >([]);
  const [posseId, setPosseId] = useState<number | null>(null);

  const [initialResearchInputs] = useState<StoredResearchInputs | null>(() =>
    typeof window === "undefined" ? null : readStoredResearchInputs(),
  );
  const [accountLevelText, setAccountLevelText] = useState(
    String(initialResearchInputs?.accountLevel ?? DEFAULT_ACCOUNT_LEVEL),
  );
  const [ownedPosseText, setOwnedPosseText] = useState(
    String(initialResearchInputs?.ownedPosseCount ?? DEFAULT_OWNED_POSSE_COUNT),
  );
  const [accountLevel, setAccountLevel] = useState(
    initialResearchInputs?.accountLevel ?? DEFAULT_ACCOUNT_LEVEL,
  );
  const [ownedPosseCount, setOwnedPosseCount] = useState(
    initialResearchInputs?.ownedPosseCount ?? DEFAULT_OWNED_POSSE_COUNT,
  );
  const [hsr, setHsr] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(
    initialResearchInputs?.autoUpdate ?? true,
  );
  const [negligiblePercentText, setNegligiblePercentText] = useState(
    String(
      initialResearchInputs?.negligiblePercent ?? DEFAULT_NEGLIGIBLE_PERCENT,
    ),
  );
  const [negligiblePercent, setNegligiblePercent] = useState(
    initialResearchInputs?.negligiblePercent ?? DEFAULT_NEGLIGIBLE_PERCENT,
  );
  // False during SSR and the hydration render, then true on the client so the
  // restored localStorage values only mount after hydration.
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const [selectedRelics, setSelectedRelics] = useState<SelectedRelic[]>([]);

  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [relicCatalog, setRelicCatalog] = useState<RelicCatalogEntry[] | null>(
    null,
  );
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importWarning, setImportWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        RESEARCH_INPUTS_STORAGE_KEY,
        JSON.stringify({
          accountLevel,
          ownedPosseCount,
          autoUpdate,
          negligiblePercent,
        }),
      );
    } catch {
      // Ignore quota / private-mode failures.
    }
  }, [
    accountLevel,
    ownedPosseCount,
    autoUpdate,
    negligiblePercent,
    hydrated,
  ]);

  const commitAccountLevel = useCallback(() => {
    const parsed = Number.parseInt(accountLevelText, 10);
    if (Number.isNaN(parsed)) {
      setAccountLevelText(String(accountLevel));
      return;
    }
    const next = clampAccountLevel(parsed);
    setAccountLevel(next);
    setAccountLevelText(String(next));
  }, [accountLevelText, accountLevel]);

  const commitOwnedPosseCount = useCallback(() => {
    const parsed = Number.parseInt(ownedPosseText, 10);
    if (Number.isNaN(parsed)) {
      setOwnedPosseText(String(ownedPosseCount));
      return;
    }
    const next = clampOwnedPosseCount(parsed);
    setOwnedPosseCount(next);
    setOwnedPosseText(String(next));
  }, [ownedPosseText, ownedPosseCount]);

  const commitNegligiblePercent = useCallback(() => {
    const parsed = Number.parseFloat(negligiblePercentText);
    if (Number.isNaN(parsed)) {
      setNegligiblePercentText(String(negligiblePercent));
      return;
    }
    const next = clampNegligiblePercent(parsed);
    setNegligiblePercent(next);
    setNegligiblePercentText(String(next));
  }, [negligiblePercentText, negligiblePercent]);

  const teamCompositionKey = useMemo(
    () => slots.map((slot) => slot.awakenerId ?? 0).join(","),
    [slots],
  );

  const damageDealerAwakenerIds = useMemo(() => {
    const ids: number[] = [];
    for (const anchor of anchoredAwakeners) {
      if (anchor.isDamageDealer) ids.push(anchor.awakenerId);
    }
    return ids;
  }, [anchoredAwakeners]);

  const hasAwakener = useMemo(
    () => slots.some((slot) => slot.awakenerId != null),
    [slots],
  );

  // Only expose team data while the team has at least one awakener.
  const activeTeamData = hasAwakener ? teamData : null;

  useEffect(() => {
    if (!hasAwakener) return;

    let cancelled = false;

    const handle = setTimeout(async () => {
      if (cancelled) return;
      setTeamLoading(true);
      setTeamError(null);
      const result = await loadPublicRelicPickerTeamData({ slots, posseId });
      if (cancelled) return;
      setTeamLoading(false);
      if (!result.success) {
        setTeamError(result.error);
        return;
      }
      setTeamData(result.data.teamData);
      setRelicCatalog(result.data.relicCatalog);
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [slots, posseId, hasAwakener]);

  // Ignore selected relics that are no longer present in the catalog.
  const visibleSelectedRelics = useMemo(() => {
    if (!relicCatalog) return selectedRelics;
    const validIds = new Set(relicCatalog.map((entry) => entry.relicId));
    return selectedRelics.filter((relic) => validIds.has(relic.relicId));
  }, [selectedRelics, relicCatalog]);

  const selectedRelicIds = useMemo(
    () => visibleSelectedRelics.map((r) => r.relicId),
    [visibleSelectedRelics],
  );

  // Display-only tooltip + SKeyDB deep link per relic. Depends solely on the
  // catalog and research inputs; never feeds the ranking sweep.
  const relicCardMeta = useMemo(() => {
    const map = new Map<number, RelicCardMeta>();
    if (!relicCatalog) return map;
    const inputs = { accountLevel, ownedPosseCount, hsr };
    for (const entry of relicCatalog) {
      const tooltip = resolveRelicTooltipRows(entry, inputs)
        .map(
          (row) =>
            `${formatTooltipValue(row.value, row.isPercent)} ${formatSearchTagLabel(row.tagName)}`,
        )
        .join("\n");
      map.set(entry.relicId, {
        tooltip,
        skeydbUrl: resolveSkeydbRelicUrl(entry.name, entry.tier),
      });
    }
    return map;
  }, [relicCatalog, accountLevel, ownedPosseCount, hsr]);

  const {
    ranking,
    computing,
    stale,
    recalculate,
    progress,
    error: rankingError,
    negligible,
  } = useRelicRanking({
    teamData: activeTeamData,
    relicCatalog,
    damageDealerAwakenerIds,
    selectedRelicIds,
    accountLevel,
    ownedPosseCount,
    hsr,
    autoUpdate,
    negligiblePercent,
    teamCompositionKey,
  });

  const handleImport = useCallback((result: ImportTeamResult) => {
    // Clear the previous team first: slots replace awakener/wheel/covenant, and
    // the anchored damage-dealer flags + selected relics are dropped outright.
    setSlots(result.slots);
    setAnchoredAwakeners([]);
    setSelectedRelics([]);
    setPosseId(result.posseId);
    setImportWarning(formatIngameImportWarningMessage(result.warnings));
  }, []);

  function handleAddRelic(entry: RelicCatalogEntry) {
    setSelectedRelics((prev) =>
      prev.some((r) => r.relicId === entry.relicId)
        ? prev
        : [
            ...prev,
            { relicId: entry.relicId, name: entry.name, tier: entry.tier },
          ],
    );
  }

  function handleRemoveRelic(relicId: number) {
    setSelectedRelics((prev) => prev.filter((r) => r.relicId !== relicId));
  }

  const visibleRanking = activeTeamData && relicCatalog ? ranking : null;
  const baselineTotal = visibleRanking?.baselineTotal ?? null;
  const rankedRows = visibleRanking?.ranked ?? [];
  // Keep relics that share an effect adjacent. Sorted by percent then name, so
  // group members may be interleaved with other same-percent relics; collecting
  // by representative and emitting first-seen order pulls each group together.
  const displayGroups = useMemo<DisplayRelicGroup[]>(() => {
    const byRepresentative = new Map<number, DisplayRelicGroup>();
    const groups: DisplayRelicGroup[] = [];
    for (const row of rankedRows) {
      const representativeId = row.representativeId ?? row.entry.relicId;
      let group = byRepresentative.get(representativeId);
      if (group == null) {
        group = {
          representativeId,
          percentIncrease: row.percentIncrease,
          members: [],
        };
        byRepresentative.set(representativeId, group);
        groups.push(group);
      }
      group.members.push(row);
    }
    return groups;
  }, [rankedRows]);
  const showLoading = hasAwakener && teamLoading;
  // Busy while a ranking sweep is in flight. Add buttons stay disabled, but the
  // partial ranking is shown as chunks land; the blocking overlay only covers
  // the panel until the first results appear. In manual mode idle, no sweep is
  // running, so the last results stay interactive.
  const rankingBusy = computing;
  const showRankingOverlay = rankingBusy && rankedRows.length === 0;
  const canCalculate = activeTeamData != null && relicCatalog != null;
  const calculateDisabled =
    computing || !canCalculate || (!stale && ranking != null);

  if (!hydrated) {
    return <CalculatorPendingHydration />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--mt-border)] bg-[var(--mt-surface)] p-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--mt-ink-muted)]">
Total Burst Damage Approximation
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--mt-ink)]">
          {baselineTotal == null ? "—" : formatTotal(baselineTotal)}
        </p>
        {showLoading && (
          <p className="mt-1 text-xs text-[var(--mt-ink-muted)]">
            Loading team data...
          </p>
        )}
        {rankingBusy && (
          <p className="mt-1 text-xs text-[var(--mt-ink-muted)]">
            Calculating relic impact
            {progress ? ` (${progress.done}/${progress.total})` : "..."}
          </p>
        )}
        {teamError && <p className="mt-2 text-xs text-red-600">{teamError}</p>}
        {rankingError && (
          <p className="mt-2 text-xs text-red-600">{rankingError}</p>
        )}
        {importWarning && (
          <p className="mt-2 text-xs text-amber-700">{importWarning}</p>
        )}
      </div>

      <div className="relative rounded-xl border border-[var(--mt-border)] bg-[var(--mt-surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--mt-ink-muted)]">
            Relic Impact (by Total Damage %)
          </p>
          <div className="flex items-center gap-3">
            <label
              className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--mt-ink)]"
              title="Automatically recalculate relic impact on every change"
            >
              <input
                type="checkbox"
                role="switch"
                checked={autoUpdate}
                onChange={(event) => setAutoUpdate(event.target.checked)}
                className="h-4 w-4 rounded border-[var(--mt-border)] accent-[var(--mt-ember)]"
              />
              Auto-update
            </label>
            {!autoUpdate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={recalculate}
                disabled={calculateDisabled}
                title="Calculate relic impact for the current team"
                className="border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] text-[var(--mt-ink)] hover:bg-[rgb(255_245_235_/_0.9)] focus-visible:ring-[var(--mt-ember)]"
              >
                Calculate
              </Button>
            )}
          </div>
        </div>

        {rankedRows.length > 0 && (
          <p className="mt-1 text-xs text-[var(--mt-ink-muted)]">
            Hover a relic for its resolved effects · Right-click to open it on
            SKeyDB.
          </p>
        )}

        {stale && !rankingBusy && (
          <p className="mt-2 text-xs text-amber-700">
            Results may be out of date — press Calculate to update.
          </p>
        )}

        {rankingBusy && rankedRows.length > 0 && progress && (
          <p className="mt-2 text-xs text-[var(--mt-ink-muted)]">
            Computing relic impact… {progress.done}/{progress.total} evaluated
          </p>
        )}

        {!hasAwakener ? (
          <p className="mt-3 text-sm text-[var(--mt-ink-muted)]">
            Select at least one Awakener to compare relics.
          </p>
        ) : !relicCatalog ? (
          <p className="mt-3 text-sm text-[var(--mt-ink-muted)]">
            Loading relic catalog...
          </p>
        ) : rankedRows.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-3">
            {displayGroups.map((group) => {
              const first = group.members[0];
              if (first == null) return null;
              if (group.members.length === 1) {
                return (
                  <li key={first.entry.relicId} className="w-16">
                    <RankedRelicButton
                      entry={first.entry}
                      meta={relicCardMeta.get(first.entry.relicId)}
                      disabled={rankingBusy}
                      showPercent
                      percentIncrease={first.percentIncrease}
                      widthClass="w-full"
                      onAdd={handleAddRelic}
                    />
                  </li>
                );
              }
              return (
                <li
                  key={`group-${group.representativeId}`}
                  role="group"
                  aria-label={`${group.members.length} relics with the same effect`}
                  className="flex w-fit flex-col items-center gap-1 rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.4)] p-1"
                >
                  <span className="text-xs font-medium tabular-nums text-[var(--mt-ember-deep)]">
                    {formatPercent(group.percentIncrease)}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {group.members.map((row) => (
                      <RankedRelicButton
                        key={row.entry.relicId}
                        entry={row.entry}
                        meta={relicCardMeta.get(row.entry.relicId)}
                        disabled={rankingBusy}
                        showPercent={false}
                        percentIncrease={row.percentIncrease}
                        widthClass="w-16"
                        onAdd={handleAddRelic}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : visibleRanking && !rankingBusy ? (
          <p className="mt-3 text-sm text-[var(--mt-ink-muted)]">
            {negligible.length > 0
              ? "All remaining damage relics are negligible."
              : "No eligible damage relics for this team."}
          </p>
        ) : !visibleRanking && !rankingBusy ? (
          <p className="mt-3 text-sm text-[var(--mt-ink-muted)]">
            Press Calculate to see relic impact.
          </p>
        ) : null}

        {showRankingOverlay && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-[var(--mt-surface)]/80 text-[var(--mt-ink-muted)]"
          >
            <span
              aria-hidden="true"
              className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
            <span className="text-xs font-medium">
              Computing relic impact...
            </span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--mt-border)] bg-[var(--mt-surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--mt-ink-muted)]">
            Negligible ({negligible.length})
          </p>
          <label
            className="flex items-center gap-2 text-xs font-medium text-[var(--mt-ink)]"
            title="Relics at or below this Total Damage % move here and are skipped in later calculations"
          >
            Ignore ≤
            <Input
              type="number"
              min={MIN_NEGLIGIBLE_PERCENT}
              max={MAX_NEGLIGIBLE_PERCENT}
              step={0.1}
              autoComplete="off"
              aria-label="Negligible relic threshold percent"
              value={negligiblePercentText}
              onChange={(event) =>
                setNegligiblePercentText(event.target.value)
              }
              onBlur={commitNegligiblePercent}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="w-20 border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] text-[var(--mt-ink)] focus-visible:ring-[var(--mt-ember)]"
            />
            %
          </label>
        </div>
        {negligible.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--mt-ink-muted)]">
            No negligible relics.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-3">
            {negligible.map((row) => (
              <li key={row.entry.relicId} className="w-16">
                <RankedRelicButton
                  entry={row.entry}
                  meta={relicCardMeta.get(row.entry.relicId)}
                  disabled={rankingBusy}
                  showPercent={false}
                  percentIncrease={row.percentIncrease}
                  widthClass="w-full"
                  onAdd={handleAddRelic}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-[var(--mt-border)] bg-[var(--mt-surface)] p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--mt-ink-muted)]">
          Selected Relics ({visibleSelectedRelics.length})
        </p>
        {visibleSelectedRelics.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--mt-ink-muted)]">
            No relics selected yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-3">
            {visibleSelectedRelics.map((relic) => {
              const meta = relicCardMeta.get(relic.relicId);
              return (
                <li key={relic.relicId}>
                  <button
                    type="button"
                    onClick={() => handleRemoveRelic(relic.relicId)}
                    title={meta?.tooltip ?? `Remove ${relic.name}`}
                    aria-label={`Remove ${relic.name}`}
                    onContextMenu={(event) => {
                      if (!meta?.skeydbUrl) return;
                      event.preventDefault();
                      window.open(
                        meta.skeydbUrl,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                    className="flex cursor-pointer items-center justify-center rounded-md border border-transparent p-1 hover:border-[var(--mt-border)] hover:bg-[rgb(255_245_235_/_0.4)] focus-visible:border-[var(--mt-border)] focus-visible:outline-none"
                  >
                    <span className="flex size-14 items-center justify-center overflow-hidden rounded-md">
                      <AssetIcon
                        src={resolveSkeydbAssetUrl("relic", relic.name)}
                        alt={relic.name}
                        size={54}
                        className="scale-[1.15] rounded-none object-cover"
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <RelicTeamBuilder
        slots={slots}
        anchoredAwakeners={anchoredAwakeners}
        awakenerOptions={awakenerOptions}
        gearOptions={gearOptions}
        posseId={posseId}
        onSlotsChange={setSlots}
        onAnchoredChange={setAnchoredAwakeners}
        onPosseChange={setPosseId}
        accountLevelText={accountLevelText}
        onAccountLevelTextChange={setAccountLevelText}
        onCommitAccountLevel={commitAccountLevel}
        ownedPosseText={ownedPosseText}
        onOwnedPosseTextChange={setOwnedPosseText}
        onCommitOwnedPosseCount={commitOwnedPosseCount}
        hsr={hsr}
        onHsrChange={setHsr}
        importing={importing}
        onImportOpen={() => setImportOpen(true)}
      />

      <ImportTeamModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
        importing={importing}
        onImportingChange={setImporting}
        importCode={importTeamCodePublic}
      />
    </div>
  );
}
