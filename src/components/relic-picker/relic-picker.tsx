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
import { AssetIcon } from "@/lib/assets/asset-icon";
import { resolveSkeydbAssetUrl } from "@/lib/assets/resolve-asset-url";
import {
  importTeamCodePublic,
  loadPublicRelicPickerTeamData,
} from "@/lib/actions/public-relic-picker";
import {
  clampAccountLevel,
  DEFAULT_ACCOUNT_LEVEL,
  DEFAULT_OWNED_POSSE_COUNT,
} from "@/lib/path-carver/relic-research-curve";
import type { RelicCatalogEntry } from "@/lib/path-carver/relic-manifestations";
import type { AnchoredAwakenerState } from "@/lib/path-carver/types";
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

const MIN_OWNED_POSSE_COUNT = 1;
const MAX_OWNED_POSSE_COUNT = 50;

const subscribeNoop = () => () => {};

function clampOwnedPosseCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_OWNED_POSSE_COUNT;
  return Math.max(
    MIN_OWNED_POSSE_COUNT,
    Math.min(MAX_OWNED_POSSE_COUNT, Math.floor(value)),
  );
}

const RESEARCH_INPUTS_STORAGE_KEY = "mt.relic-picker.inputs";

type StoredResearchInputs = {
  accountLevel: number;
  ownedPosseCount: number;
  autoUpdate: boolean;
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
    return { accountLevel, ownedPosseCount, autoUpdate };
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
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

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
        JSON.stringify({ accountLevel, ownedPosseCount, autoUpdate }),
      );
    } catch {
      // Ignore quota / private-mode failures.
    }
  }, [accountLevel, ownedPosseCount, autoUpdate, hydrated]);

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

  const {
    ranking,
    computing,
    stale,
    recalculate,
    progress,
    error: rankingError,
  } = useRelicRanking({
    teamData: activeTeamData,
    relicCatalog,
    damageDealerAwakenerIds,
    selectedRelicIds,
    accountLevel,
    ownedPosseCount,
    hsr,
    autoUpdate,
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
          Total Damage
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
                className="h-4 w-4 rounded border-zinc-300 accent-[var(--mt-ember)]"
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
              >
                Calculate
              </Button>
            )}
          </div>
        </div>

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
            {rankedRows.map((row) => (
              <li key={row.entry.relicId} className="w-16">
                <button
                  type="button"
                  onClick={() => handleAddRelic(row.entry)}
                  disabled={rankingBusy}
                  title={`Add ${row.entry.name}`}
                  aria-label={`Add ${row.entry.name}`}
                  className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-md border border-transparent p-1 hover:border-[var(--mt-border)] hover:bg-[rgb(255_245_235_/_0.4)] focus-visible:border-[var(--mt-border)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-xs font-medium tabular-nums text-[var(--mt-ember-deep)]">
                    {formatPercent(row.percentIncrease)}
                  </span>
                  <AssetIcon
                    src={resolveSkeydbAssetUrl("relic", row.entry.name)}
                    alt={row.entry.name}
                    size={40}
                    darkChip
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : visibleRanking && !rankingBusy ? (
          <p className="mt-3 text-sm text-[var(--mt-ink-muted)]">
            No eligible damage relics for this team.
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
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--mt-ink-muted)]">
          Selected Relics ({visibleSelectedRelics.length})
        </p>
        {visibleSelectedRelics.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--mt-ink-muted)]">
            No relics selected yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-3">
            {visibleSelectedRelics.map((relic) => (
              <li key={relic.relicId}>
                <button
                  type="button"
                  onClick={() => handleRemoveRelic(relic.relicId)}
                  title={`Remove ${relic.name}`}
                  aria-label={`Remove ${relic.name}`}
                  className="flex cursor-pointer items-center justify-center rounded-md border border-transparent p-1 hover:border-[var(--mt-border)] hover:bg-[rgb(255_245_235_/_0.4)] focus-visible:border-[var(--mt-border)] focus-visible:outline-none"
                >
                  <AssetIcon
                    src={resolveSkeydbAssetUrl("relic", relic.name)}
                    alt={relic.name}
                    size={40}
                    darkChip
                  />
                </button>
              </li>
            ))}
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
