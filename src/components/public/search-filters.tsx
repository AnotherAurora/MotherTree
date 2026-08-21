"use client";

import { Fragment, useId, useState, useTransition } from "react";
import type { Enums } from "@/lib/database.types";
import { SearchTagCombobox } from "@/components/public/search-tag-combobox";
import { SearchResultsTable } from "@/components/public/search-results-table";
import { runPublicSearch } from "@/lib/actions/public-search";
import type {
  AttackerLayerBucket,
  SearchAwakenerEnlightenmentValue,
  SearchFilterOptions,
  SearchFromValue,
  SearchRequiredRealmId,
} from "@/lib/public/search-filter-options";
import {
  SEARCH_AWAKENER_ENLIGHTENMENT_OPTIONS,
  SEARCH_DEFAULT_AWAKENER_ENLIGHTENMENT,
  formatAwakenerEnlightenmentLabel,
  formatSearchBuffRestrictionLabel,
  formatSearchDependencyStatLabel,
  formatSearchRealmLabel,
  formatSearchTagLabel,
  formatSearchTargetTypeLabel,
  isAwakenerEnlightenmentValue,
} from "@/lib/public/search-filter-options";
import type { SearchResultRow } from "@/lib/public/search-results";
import { cn } from "@/lib/utils";

export type SearchTagFamily = "attacker" | "defender" | "support";

export type SearchFilterState = {
  tagId: number | null;
  tagFamily: SearchTagFamily | null;
  from: SearchFromValue | null;
  targetType: Enums<"target_type"> | null;
  dependencyStat: Enums<"all_stats"> | null;
  buffRestriction: Enums<"source_type"> | null;
  everyTurn: boolean | null;
  triggerConditionTagId: number | null;
  requiredRealmId: SearchRequiredRealmId | null;
};

const EMPTY_STATE: SearchFilterState = {
  tagId: null,
  tagFamily: null,
  from: null,
  targetType: null,
  dependencyStat: null,
  buffRestriction: null,
  everyTurn: null,
  triggerConditionTagId: null,
  requiredRealmId: null,
};

const selectClassName = cn(
  "h-10 w-full min-w-0 rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] px-2 text-sm text-[var(--mt-ink)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mt-ember)]",
);

const labelClassName = "text-sm font-medium text-[var(--mt-ink)]";
const secondaryLabelClassName =
  "text-sm font-medium text-[var(--mt-ink-muted)]";
const rowClassName =
  "grid gap-2 sm:grid-cols-[minmax(9rem,11rem)_1fr] sm:items-start";
const layerLabelClassName =
  "text-xs uppercase tracking-wide text-[var(--mt-ink-muted)]";

const ATTACKER_LAYERS = ["pre_add", "add", "post_add"] as const;

const ATTACKER_LAYER_LABELS: Record<AttackerLayerBucket, string> = {
  pre_add: "Before add",
  add: "Add",
  post_add: "After add",
};

const ATTACKER_LAYER_ENGINE_NAMES: Record<AttackerLayerBucket, string> = {
  pre_add: "pre_add",
  add: "add",
  post_add: "post_add",
};

const TAG_FAMILY_LABELS: Record<SearchTagFamily, string> = {
  attacker: "Attacker",
  defender: "Defender",
  support: "Support",
};

function parseOptionalNumber(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function findTagLabel(
  options: SearchFilterOptions,
  family: SearchTagFamily,
  tagId: number,
): string | null {
  const pools =
    family === "attacker"
      ? [
          ...options.attacker.pre_add,
          ...options.attacker.add,
          ...options.attacker.post_add,
        ]
      : family === "defender"
        ? options.defender
        : options.support;
  const tag = pools.find((t) => t.id === tagId);
  return tag ? formatSearchTagLabel(tag.tag_name) : null;
}

function isSearchFilterEmpty(state: SearchFilterState): boolean {
  return (
    state.tagId == null &&
    state.tagFamily == null &&
    state.from == null &&
    state.targetType == null &&
    state.dependencyStat == null &&
    state.buffRestriction == null &&
    state.everyTurn == null &&
    state.triggerConditionTagId == null &&
    state.requiredRealmId == null
  );
}

function summarizeSearchFilters(
  state: SearchFilterState,
  options: SearchFilterOptions,
): string {
  const parts: string[] = [];

  if (state.tagId != null && state.tagFamily != null) {
    const label =
      findTagLabel(options, state.tagFamily, state.tagId) ??
      `Tag #${state.tagId}`;
    parts.push(`${TAG_FAMILY_LABELS[state.tagFamily]}: ${label}`);
  }

  if (state.from != null) {
    const fromOpt = options.from.find((o) => o.value === state.from);
    parts.push(`From: ${fromOpt?.label ?? state.from}`);
  }

  if (state.targetType != null) {
    parts.push(`Target Type: ${formatSearchTargetTypeLabel(state.targetType)}`);
  }

  if (state.dependencyStat != null) {
    parts.push(
      `Dependency Stat: ${formatSearchDependencyStatLabel(state.dependencyStat)}`,
    );
  }

  if (state.buffRestriction != null) {
    parts.push(
      `Buff Restriction: ${formatSearchBuffRestrictionLabel(state.buffRestriction)}`,
    );
  }

  if (state.everyTurn === true) {
    parts.push("Every Turn");
  }

  if (state.triggerConditionTagId != null) {
    const tag = options.triggerCondition.find(
      (t) => t.id === state.triggerConditionTagId,
    );
    parts.push(
      `Trigger: ${tag ? formatSearchTagLabel(tag.tag_name) : `#${state.triggerConditionTagId}`}`,
    );
  }

  if (state.requiredRealmId != null) {
    const realm = options.requiredRealm.find(
      (r) => r.id === state.requiredRealmId,
    );
    parts.push(
      `Realm: ${realm ? formatSearchRealmLabel(realm.name ?? "") : `#${state.requiredRealmId}`}`,
    );
  }

  return parts.join(" · ");
}

type SearchFiltersProps = {
  options: SearchFilterOptions;
};

type SearchResultsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | {
      status: "success";
      rows: SearchResultRow[];
      truncated: boolean;
      sourceTruncated: boolean;
      resultsTruncated: boolean;
    };

export function SearchFilters({ options }: SearchFiltersProps) {
  const baseId = useId();
  const [state, setState] = useState<SearchFilterState>(EMPTY_STATE);
  // Separate from Clear Filters / empty-filter gating — always-on assumption.
  const [awakenerEnlightenment, setAwakenerEnlightenment] =
    useState<SearchAwakenerEnlightenmentValue>(
      SEARCH_DEFAULT_AWAKENER_ENLIGHTENMENT,
    );
  const [results, setResults] = useState<SearchResultsState>({
    status: "idle",
  });
  const [isPending, startTransition] = useTransition();
  const empty = isSearchFilterEmpty(state);
  const enlightenmentSummary = `Awakener Enlightenment: ${formatAwakenerEnlightenmentLabel(awakenerEnlightenment)}`;
  const filterSummary = empty ? "" : summarizeSearchFilters(state, options);
  const summary = empty
    ? `No filters applied. · ${enlightenmentSummary}`
    : `${filterSummary} · ${enlightenmentSummary}`;
  const loading = isPending || results.status === "loading";
  const searchDisabled = empty || loading;
  const canClear =
    !empty || results.status === "success" || results.status === "error";

  function setTagSelection(family: SearchTagFamily, id: number | null) {
    setState((prev) => ({
      ...prev,
      tagId: id,
      tagFamily: id == null ? null : family,
    }));
  }

  function clearFilters() {
    setState(EMPTY_STATE);
    setResults({ status: "idle" });
    // Intentionally leave awakenerEnlightenment unchanged.
  }

  function runSearch() {
    if (isSearchFilterEmpty(state)) return;
    setResults({ status: "loading" });
    startTransition(async () => {
      const result = await runPublicSearch({
        tagId: state.tagId,
        from: state.from,
        targetType: state.targetType,
        dependencyStat: state.dependencyStat,
        buffRestriction: state.buffRestriction,
        everyTurn: state.everyTurn,
        triggerConditionTagId: state.triggerConditionTagId,
        requiredRealmId: state.requiredRealmId,
        awakenerEnlightenment,
      });
      if (!result.success) {
        setResults({ status: "error", error: result.error });
        return;
      }
      setResults({
        status: "success",
        rows: result.rows,
        truncated: result.truncated,
        sourceTruncated: result.sourceTruncated,
        resultsTruncated: result.resultsTruncated,
      });
    });
  }

  function attackerValue(layer: AttackerLayerBucket): number | null {
    if (state.tagFamily !== "attacker" || state.tagId == null) return null;
    const inBucket = options.attacker[layer].some((t) => t.id === state.tagId);
    return inBucket ? state.tagId : null;
  }

  function defenderValue(): number | null {
    if (state.tagFamily !== "defender" || state.tagId == null) return null;
    return state.tagId;
  }

  function supportValue(): number | null {
    if (state.tagFamily !== "support" || state.tagId == null) return null;
    return state.tagId;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <p
          className="min-w-0 flex-1 text-sm text-[var(--mt-ink-muted)]"
          aria-live="polite"
        >
          {summary}
        </p>
        <button
          type="button"
          aria-disabled={!canClear}
          onClick={() => {
            if (!canClear) return;
            clearFilters();
          }}
          className={cn(
            "shrink-0 text-sm font-medium underline underline-offset-4",
            !canClear
              ? "cursor-not-allowed text-[var(--mt-ink-muted)] no-underline opacity-50"
              : "text-[var(--mt-ember)] hover:text-[var(--mt-ember-deep)]",
          )}
        >
          Clear Filters
        </button>
      </div>

      <section
        aria-labelledby={`${baseId}-assumptions-heading`}
        className="space-y-2"
      >
        <h2
          id={`${baseId}-assumptions-heading`}
          className="text-sm font-medium uppercase tracking-wide text-[var(--mt-ink-muted)]"
        >
          Assumptions
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label
            htmlFor={`${baseId}-awakener-enlightenment`}
            className={secondaryLabelClassName}
          >
            Awakener Enlightenment
          </label>
          <select
            id={`${baseId}-awakener-enlightenment`}
            className={cn(selectClassName, "w-auto min-w-[4.5rem]")}
            value={awakenerEnlightenment}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (isAwakenerEnlightenmentValue(n)) {
                setAwakenerEnlightenment(n);
              }
            }}
          >
            {SEARCH_AWAKENER_ENLIGHTENMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section
        aria-labelledby={`${baseId}-tags-heading`}
        className="space-y-5 rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.35)] px-4 py-5 sm:px-5"
      >
        <div className="space-y-1">
          <h2
            id={`${baseId}-tags-heading`}
            className="font-[family-name:var(--font-mother-display)] text-2xl font-semibold tracking-tight text-[var(--mt-ink)]"
          >
            Tags
          </h2>
          <p className="text-sm text-[var(--mt-ink-muted)]">
            Filter by one Attacker, Defender, or Support tag at a time.
          </p>
        </div>

        <div className={rowClassName}>
          <div>
            <div className={labelClassName}>Attacker</div>
            <p className="mt-1 text-xs text-[var(--mt-ink-muted)]">
              <span className="sm:hidden">Applied top → bottom</span>
              <span className="hidden sm:inline">Applied left → right</span>
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {ATTACKER_LAYERS.map((layer, index) => {
              const selectId = `${baseId}-attacker-${layer}`;
              return (
                <Fragment key={layer}>
                  {index > 0 ? (
                    <span
                      aria-hidden
                      className="self-center text-sm text-[var(--mt-ink-muted)] sm:pt-5"
                    >
                      <span className="sm:hidden">↓</span>
                      <span className="hidden sm:inline">→</span>
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1 space-y-1">
                    <label
                      htmlFor={selectId}
                      className={layerLabelClassName}
                      title={ATTACKER_LAYER_ENGINE_NAMES[layer]}
                    >
                      {ATTACKER_LAYER_LABELS[layer]}
                    </label>
                    <SearchTagCombobox
                      id={selectId}
                      value={attackerValue(layer)}
                      onChange={(id) => setTagSelection("attacker", id)}
                      options={options.attacker[layer]}
                    />
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <div id={`${baseId}-defender-label`} className={labelClassName}>
              Defender
            </div>
            <SearchTagCombobox
              id={`${baseId}-defender`}
              aria-labelledby={`${baseId}-defender-label`}
              value={defenderValue()}
              onChange={(id) => setTagSelection("defender", id)}
              options={options.defender}
            />
          </div>

          <div className="space-y-1">
            <div id={`${baseId}-support-label`} className={labelClassName}>
              Support
            </div>
            <SearchTagCombobox
              id={`${baseId}-support`}
              aria-labelledby={`${baseId}-support-label`}
              value={supportValue()}
              onChange={(id) => setTagSelection("support", id)}
              options={options.support}
            />
          </div>
        </div>
      </section>

      <section
        aria-labelledby={`${baseId}-more-heading`}
        className="space-y-4 border-t border-[var(--mt-border)]/40 pt-6"
      >
        <div className="space-y-1">
          <h2
            id={`${baseId}-more-heading`}
            className="text-sm font-medium uppercase tracking-wide text-[var(--mt-ink-muted)]"
          >
            More criteria
          </h2>
          <p className="text-sm text-[var(--mt-ink-muted)]">
            Narrow results further.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label
              htmlFor={`${baseId}-from`}
              className={secondaryLabelClassName}
            >
              From
            </label>
            <select
              id={`${baseId}-from`}
              className={selectClassName}
              value={state.from ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setState((prev) => ({
                  ...prev,
                  from:
                    v === "awakener" ||
                    v === "wheel" ||
                    v === "posse" ||
                    v === "covenant"
                      ? v
                      : null,
                }));
              }}
            >
              <option value="">No Filter</option>
              {options.from.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor={`${baseId}-target-type`}
              className={secondaryLabelClassName}
            >
              Target Type
            </label>
            <select
              id={`${baseId}-target-type`}
              className={selectClassName}
              value={state.targetType ?? ""}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  targetType: (e.target.value ||
                    null) as SearchFilterState["targetType"],
                }))
              }
            >
              <option value="">No Filter</option>
              {options.targetType.map((v) => (
                <option key={v} value={v}>
                  {formatSearchTargetTypeLabel(v)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor={`${baseId}-buff-restriction`}
              className={secondaryLabelClassName}
            >
              Buff Restriction
            </label>
            <select
              id={`${baseId}-buff-restriction`}
              className={selectClassName}
              value={state.buffRestriction ?? ""}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  buffRestriction: (e.target.value ||
                    null) as SearchFilterState["buffRestriction"],
                }))
              }
            >
              <option value="">No Filter</option>
              {options.buffRestriction.map((v) => (
                <option key={v} value={v}>
                  {formatSearchBuffRestrictionLabel(v)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor={`${baseId}-required-realm`}
              className={secondaryLabelClassName}
            >
              Required Realm
            </label>
            <select
              id={`${baseId}-required-realm`}
              className={selectClassName}
              value={
                state.requiredRealmId != null
                  ? String(state.requiredRealmId)
                  : ""
              }
              onChange={(e) => {
                const id = parseOptionalNumber(e.target.value);
                setState((prev) => ({
                  ...prev,
                  requiredRealmId:
                    id === 1 || id === 2 || id === 4 || id === 6 ? id : null,
                }));
              }}
            >
              <option value="">No Filter</option>
              {options.requiredRealm.map((realm) => (
                <option key={realm.id} value={realm.id}>
                  {formatSearchRealmLabel(realm.name ?? "")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor={`${baseId}-dependency-stat`}
              className={secondaryLabelClassName}
            >
              Dependency Stat
            </label>
            <select
              id={`${baseId}-dependency-stat`}
              className={selectClassName}
              value={state.dependencyStat ?? ""}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  dependencyStat: (e.target.value ||
                    null) as SearchFilterState["dependencyStat"],
                }))
              }
            >
              <option value="">No Filter</option>
              {options.dependencyStat.map((v) => (
                <option key={v} value={v}>
                  {formatSearchDependencyStatLabel(v)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div
              id={`${baseId}-trigger-condition-label`}
              className={secondaryLabelClassName}
            >
              Trigger Condition
            </div>
            <SearchTagCombobox
              id={`${baseId}-trigger-condition`}
              aria-labelledby={`${baseId}-trigger-condition-label`}
              value={state.triggerConditionTagId}
              onChange={(id) =>
                setState((prev) => ({
                  ...prev,
                  triggerConditionTagId: id,
                }))
              }
              options={options.triggerCondition}
            />
          </div>

          <div className="flex items-end">
            <div className="flex h-10 items-center gap-2">
              <input
                id={`${baseId}-every-turn`}
                type="checkbox"
                checked={state.everyTurn === true}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    everyTurn: e.target.checked ? true : null,
                  }))
                }
                className="size-4 accent-[var(--mt-ember)]"
              />
              <label
                htmlFor={`${baseId}-every-turn`}
                className="text-sm text-[var(--mt-ink)]"
              >
                Every Turn
              </label>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <button
          type="button"
          onClick={() => {
            if (searchDisabled) return;
            runSearch();
          }}
          aria-disabled={searchDisabled ? true : undefined}
          className={cn(
            "inline-flex h-10 w-full items-center justify-center rounded-md px-5 text-sm font-medium sm:w-auto",
            "bg-[var(--mt-ember)] text-[rgb(255_248_240)]",
            "hover:bg-[var(--mt-ember-deep)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mt-ember)]",
            searchDisabled && "cursor-not-allowed opacity-60",
          )}
        >
          {loading ? "Searching…" : "Search"}
        </button>
        {empty ? (
          <p className="text-sm text-[var(--mt-ink-muted)]">
            Select at least one filter from Tags or More criteria to search.
          </p>
        ) : null}
      </div>

      <section
        aria-labelledby={`${baseId}-results-heading`}
        aria-busy={loading}
        className="space-y-3 rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.35)] px-4 py-5 sm:px-5"
      >
        <h2
          id={`${baseId}-results-heading`}
          className="font-[family-name:var(--font-mother-display)] text-2xl font-semibold tracking-tight text-[var(--mt-ink)]"
        >
          Results
        </h2>

        {!loading && results.status === "success" ? (
          <p className="text-sm text-[var(--mt-ink-muted)]" aria-live="polite">
            {results.rows.length === 1
              ? "1 record"
              : `${results.rows.length} records`}
            {results.resultsTruncated ? " (top 500 by value)" : ""}
          </p>
        ) : null}

        {!loading &&
        results.status === "success" &&
        results.sourceTruncated ? (
          <p
            role="alert"
            className="rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.35)] px-4 py-3 text-sm text-[var(--mt-ink)]"
          >
            Search catalog data was incomplete. Results may be missing rows —
            narrow your filters or contact the maintainer.
          </p>
        ) : null}

        {results.status === "idle" ? (
          <p className="text-sm text-[var(--mt-ink-muted)]">
            Select at least one filter, then press Search.
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-[var(--mt-ink-muted)]">Loading results…</p>
        ) : null}

        {!loading && results.status === "error" ? (
          <p
            role="alert"
            className="rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.35)] px-4 py-3 text-sm text-[var(--mt-ink)]"
          >
            Could not run search: {results.error}
          </p>
        ) : null}

        {!loading && results.status === "success" ? (
          <SearchResultsTable
            rows={results.rows}
            resultsTruncated={results.resultsTruncated}
          />
        ) : null}
      </section>
    </div>
  );
}
