"use client";

import { useMemo } from "react";
import type { ScalarMathStep } from "@/lib/path-carver/apply-interactions";
import type { Awakener } from "@/lib/team-data/types";

type ReviewTagsMathDebugProps = {
  steps: ScalarMathStep[];
  awakeners: Awakener[];
};

type TagMathGroup = {
  tagId: number;
  tagName: string;
  bases: Extract<ScalarMathStep, { kind: "base" }>[];
  ops: Extract<ScalarMathStep, { kind: "op" }>[];
  total: number | null;
};

function formatNum(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const fixed = value.toFixed(4).replace(/\.?0+$/, "");
  return fixed === "-0" ? "0" : fixed;
}

function formatOwner(
  owner: string,
  nameById: Map<number, string>,
): string {
  const match = /^awakener:(\d+)$/.exec(owner);
  if (!match) return owner;
  const id = Number(match[1]);
  return nameById.get(id) ?? `#${id}`;
}

function formatSourceLabel(
  sourceLabel: string,
  nameById: Map<number, string>,
): string {
  return sourceLabel.replace(/\(awakener #(\d+)\)/g, (_, idStr: string) => {
    const id = Number(idStr);
    return `(${nameById.get(id) ?? `#${id}`})`;
  });
}

function formatOpLine(
  step: Extract<ScalarMathStep, { kind: "op" }>,
  nameById: Map<number, string>,
): string {
  const roundNote =
    step.rounded && step.op !== "add_scaled"
      ? ` (ceil ${formatNum(step.afterRaw)}→${formatNum(step.after)})`
      : "";
  const valueChange =
    step.op === "add_scaled" || !step.rounded
      ? `${formatNum(step.before)} → ${formatNum(step.after)}`
      : `${formatNum(step.before)} → ${formatNum(step.afterRaw)}${roundNote}`;

  const ownerLabel =
    step.effectSources.length > 0
      ? step.effectSources
          .map((s) => formatSourceLabel(s, nameById))
          .join(", ")
      : formatOwner(step.owner, nameById);

  const restrictionNote =
    step.buffRestrictionMet != null
      ? ` | buff_restriction=${step.buffRestrictionMet}`
      : "";
  const leafNote =
    step.leafContext !== undefined
      ? ` | leaf=${step.leafContext ?? "null"}`
      : "";

  const layerNote = ` | layer=${step.layer ?? "null"}`;

  return (
    `pass ${step.pass} | ${step.op} | ${step.tagName} ← ${step.modifierTagName}` +
    ` × ${formatNum(step.factor)} (mod ${formatNum(step.modifierValue)})` +
    ` | ${ownerLabel} | ${valueChange}${layerNote}${restrictionNote}${leafNote}`
  );
}

export function ReviewTagsMathDebug({
  steps,
  awakeners,
}: ReviewTagsMathDebugProps) {
  const nameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const awakener of awakeners) {
      map.set(awakener.id, awakener.name ?? `#${awakener.id}`);
    }
    return map;
  }, [awakeners]);

  const { specials, groups } = useMemo(() => {
    const specials: Extract<ScalarMathStep, { kind: "special" }>[] = [];
    const byTag = new Map<number, TagMathGroup>();

    function ensure(tagId: number, tagName: string): TagMathGroup {
      let group = byTag.get(tagId);
      if (!group) {
        group = {
          tagId,
          tagName,
          bases: [],
          ops: [],
          total: null,
        };
        byTag.set(tagId, group);
      }
      return group;
    }

    for (const step of steps) {
      if (step.kind === "special") {
        specials.push(step);
        continue;
      }
      const group = ensure(step.tagId, step.tagName);
      if (step.kind === "base") group.bases.push(step);
      else if (step.kind === "op") group.ops.push(step);
      else if (step.kind === "total") group.total = step.total;
    }

    const groups = [...byTag.values()].sort((a, b) =>
      a.tagName.localeCompare(b.tagName),
    );
    return { specials, groups };
  }, [steps]);

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Debug — Scalar Sum math
        </p>
        <p className="font-mono text-xs text-zinc-600">
          Layer A base (dependency-scaled) → Keyflare Harmony →
          Keyflare→Create.Posse → team Max HP → Base Tentacle Damage →
          interaction ops by modifier layer (pre_add → add → post_add;
          leaf-gated buff restriction) → special conversions → totals.
          Multiply ops ceil after each write. Restricted ops only appear when
          leaf matches.
        </p>
      </div>

      <div className="max-h-[420px] space-y-4 overflow-y-auto rounded border border-border bg-white p-3 font-mono text-xs text-zinc-600">
        {groups.length === 0 && specials.length === 0 ? (
          <p className="text-zinc-400">No Scalar Sum math for this team.</p>
        ) : (
          <>
            {specials.length > 0 && (
              <div className="space-y-1 border-b border-zinc-200 pb-3">
                <p className="text-sm font-medium text-zinc-700">
                  Special conversions
                </p>
                <ul className="space-y-1 pl-2">
                  {specials.map((s, i) => (
                    <li key={`special-${i}`}>
                      {s.label}: {s.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {groups.map((group) => (
              <div key={group.tagId} className="space-y-1">
                <p className="text-sm font-medium text-zinc-700">
                  {group.tagName}
                </p>
                <ul className="space-y-0.5 border-l border-zinc-200 pl-2">
                  {group.bases.map((b, i) => (
                    <li key={`base-${group.tagId}-${i}`}>
                      base | {formatSourceLabel(b.sourceLabel, nameById)} | +
                      {formatNum(b.scalar)}
                      {b.rawScalar !== b.scalar
                        ? ` (raw ${formatNum(b.rawScalar)} → effective)`
                        : ""}
                    </li>
                  ))}
                  {group.ops.map((op, i) => (
                    <li key={`op-${group.tagId}-${i}`}>
                      {formatOpLine(op, nameById)}
                    </li>
                  ))}
                  {group.bases.length === 0 && group.ops.length === 0 && (
                    <li className="text-zinc-400">
                      (no base/op steps; total from special or pool only)
                    </li>
                  )}
                  <li className="pt-0.5 font-medium text-zinc-800">
                    Scalar sum ={" "}
                    {group.total != null ? formatNum(group.total) : "—"}
                  </li>
                </ul>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
