"use client";

import { useId, useState } from "react";
import type { Enums } from "@/lib/database.types";
import { SearchTagCombobox } from "@/components/public/search-tag-combobox";
import type {
  AttackerLayerBucket,
  SearchFilterOptions,
  SearchFromValue,
  SearchRequiredRealmId,
} from "@/lib/public/search-filter-options";
import { formatSearchTagLabel } from "@/lib/public/search-filter-options";
import { cn } from "@/lib/utils";

export type SearchTagFamily = "attacker" | "defender" | "support";

export type SearchFilterState = {
  tagId: number | null;
  tagFamily: SearchTagFamily | null;
  from: SearchFromValue | null;
  targetType: Enums<"target_type"> | null;
  dependencyStat: Enums<"all_stats"> | null;
  buffRestriction: Enums<"source_type"> | null;
  everyTurn: boolean;
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
  everyTurn: false,
  triggerConditionTagId: null,
  requiredRealmId: null,
};

const selectClassName = cn(
  "h-10 w-full min-w-0 rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] px-2 text-sm text-[var(--mt-ink)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mt-ember)]",
);

const labelClassName = "text-sm font-medium text-[var(--mt-ink)]";
const rowClassName =
  "grid gap-2 sm:grid-cols-[minmax(9rem,11rem)_1fr] sm:items-start";
const layerLabelClassName =
  "text-xs uppercase tracking-wide text-[var(--mt-ink-muted)]";

const ATTACKER_LAYER_LABELS: Record<AttackerLayerBucket, string> = {
  pre_add: "pre_add",
  add: "add",
  post_add: "post_add",
};

function parseOptionalNumber(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type SearchFiltersProps = {
  options: SearchFilterOptions;
};

export function SearchFilters({ options }: SearchFiltersProps) {
  const baseId = useId();
  const [state, setState] = useState<SearchFilterState>(EMPTY_STATE);

  function setTagSelection(family: SearchTagFamily, id: number | null) {
    setState((prev) => ({
      ...prev,
      tagId: id,
      tagFamily: id == null ? null : family,
    }));
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
    <div className="space-y-6">
      <div className={rowClassName}>
        <div className={labelClassName}>Attacker</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["pre_add", "add", "post_add"] as const).map((layer) => {
            const selectId = `${baseId}-attacker-${layer}`;
            return (
              <div key={layer} className="space-y-1">
                <label htmlFor={selectId} className={layerLabelClassName}>
                  {ATTACKER_LAYER_LABELS[layer]}
                </label>
                <SearchTagCombobox
                  id={selectId}
                  value={attackerValue(layer)}
                  onChange={(id) => setTagSelection("attacker", id)}
                  options={options.attacker[layer]}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className={rowClassName}>
        <label htmlFor={`${baseId}-defender`} className={labelClassName}>
          Defender
        </label>
        <SearchTagCombobox
          id={`${baseId}-defender`}
          value={defenderValue()}
          onChange={(id) => setTagSelection("defender", id)}
          options={options.defender}
        />
      </div>

      <div className={rowClassName}>
        <label htmlFor={`${baseId}-support`} className={labelClassName}>
          Support
        </label>
        <SearchTagCombobox
          id={`${baseId}-support`}
          value={supportValue()}
          onChange={(id) => setTagSelection("support", id)}
          options={options.support}
        />
      </div>

      <div className={rowClassName}>
        <label htmlFor={`${baseId}-from`} className={labelClassName}>
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
          <option value="">Any</option>
          {options.from.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className={rowClassName}>
        <label htmlFor={`${baseId}-target-type`} className={labelClassName}>
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
          <option value="">Any</option>
          {options.targetType.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className={rowClassName}>
        <label htmlFor={`${baseId}-dependency-stat`} className={labelClassName}>
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
          <option value="">Any</option>
          {options.dependencyStat.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className={rowClassName}>
        <label
          htmlFor={`${baseId}-buff-restriction`}
          className={labelClassName}
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
          <option value="">Any</option>
          {options.buffRestriction.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className={rowClassName}>
        <label htmlFor={`${baseId}-every-turn`} className={labelClassName}>
          Every Turn
        </label>
        <div className="flex h-10 items-center">
          <input
            id={`${baseId}-every-turn`}
            type="checkbox"
            checked={state.everyTurn}
            onChange={(e) =>
              setState((prev) => ({ ...prev, everyTurn: e.target.checked }))
            }
            className="size-4 accent-[var(--mt-ember)]"
            aria-label="Every Turn"
          />
        </div>
      </div>

      <div className={rowClassName}>
        <label
          htmlFor={`${baseId}-trigger-condition`}
          className={labelClassName}
        >
          Trigger Condition
        </label>
        <select
          id={`${baseId}-trigger-condition`}
          className={selectClassName}
          value={
            state.triggerConditionTagId != null
              ? String(state.triggerConditionTagId)
              : ""
          }
          onChange={(e) =>
            setState((prev) => ({
              ...prev,
              triggerConditionTagId: parseOptionalNumber(e.target.value),
            }))
          }
        >
          <option value="">Any</option>
          {options.triggerCondition.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {formatSearchTagLabel(tag.tag_name)}
            </option>
          ))}
        </select>
      </div>

      <div className={rowClassName}>
        <label htmlFor={`${baseId}-required-realm`} className={labelClassName}>
          Required Realm
        </label>
        <select
          id={`${baseId}-required-realm`}
          className={selectClassName}
          value={
            state.requiredRealmId != null ? String(state.requiredRealmId) : ""
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
          <option value="">Any</option>
          {options.requiredRealm.map((realm) => (
            <option key={realm.id} value={realm.id}>
              {realm.name}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-[var(--mt-ink-muted)]">
        Filter options are ready. Search results will plug into this state in a
        later pass.
      </p>
    </div>
  );
}
