"use client";

import { useMemo } from "react";
import type { ScalarMathStep } from "@/lib/path-carver/apply-interactions";
import type { Awakener } from "@/lib/team-data/types";

type ReviewTagsMathDebugProps = {
  steps: ScalarMathStep[];
  awakeners: Awakener[];
};

type BaseStep = Extract<ScalarMathStep, { kind: "base" }>;
type OpStep = Extract<ScalarMathStep, { kind: "op" }>;
type HitCountStep = Extract<ScalarMathStep, { kind: "hitCount" }>;
type SpecialStep = Extract<ScalarMathStep, { kind: "special" }>;

type SubjectMathBlock = {
  subjectKey: string;
  subjectLabel: string;
  bases: BaseStep[];
  ops: OpStep[];
  hitCounts: HitCountStep[];
};

type TagMathGroup = {
  tagId: number;
  tagName: string;
  subjects: SubjectMathBlock[];
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
  step: OpStep,
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
  const uniqueScalingNote =
    step.uniqueScaling != null
      ? ` | unique_scaling=${step.uniqueScaling}`
      : "";

  return (
    `pass ${step.pass} | ${step.op} | ${step.tagName} ← ${step.modifierTagName}` +
    ` × ${formatNum(step.factor)} (mod ${formatNum(step.modifierValue)})` +
    ` | ${ownerLabel} | ${valueChange}${layerNote}${uniqueScalingNote}${restrictionNote}${leafNote}`
  );
}

function subjectContribution(block: SubjectMathBlock): number | null {
  if (block.hitCounts.length > 0) {
    return block.hitCounts[block.hitCounts.length - 1]!.after;
  }
  if (block.ops.length > 0) {
    return block.ops[block.ops.length - 1]!.after;
  }
  if (block.bases.length > 0) {
    return block.bases.reduce((sum, b) => sum + b.scalar, 0);
  }
  return null;
}

function ensureSubject(
  subjects: Map<string, SubjectMathBlock>,
  subjectKey: string | undefined,
  subjectLabel: string | undefined,
): SubjectMathBlock {
  const key = subjectKey && subjectKey.length > 0 ? subjectKey : "unknown";
  let block = subjects.get(key);
  if (!block) {
    block = {
      subjectKey: key,
      subjectLabel:
        subjectLabel && subjectLabel.length > 0 ? subjectLabel : key,
      bases: [],
      ops: [],
      hitCounts: [],
    };
    subjects.set(key, block);
  } else if (
    subjectLabel &&
    subjectLabel.length > 0 &&
    block.subjectLabel === key
  ) {
    block.subjectLabel = subjectLabel;
  }
  return block;
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
    const specials: SpecialStep[] = [];
    const byTag = new Map<
      number,
      {
        tagId: number;
        tagName: string;
        subjects: Map<string, SubjectMathBlock>;
        total: number | null;
      }
    >();

    function ensureTag(tagId: number, tagName: string) {
      let group = byTag.get(tagId);
      if (!group) {
        group = {
          tagId,
          tagName,
          subjects: new Map(),
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
      if (step.kind === "total") {
        const group = ensureTag(step.tagId, step.tagName);
        group.total = step.total;
        continue;
      }

      const group = ensureTag(step.tagId, step.tagName);
      const block = ensureSubject(
        group.subjects,
        step.subjectKey,
        step.subjectLabel,
      );
      if (step.kind === "base") block.bases.push(step);
      else if (step.kind === "op") block.ops.push(step);
      else if (step.kind === "hitCount") block.hitCounts.push(step);
    }

    const groups: TagMathGroup[] = [...byTag.values()]
      .map((g) => ({
        tagId: g.tagId,
        tagName: g.tagName,
        subjects: [...g.subjects.values()],
        total: g.total,
      }))
      .sort((a, b) => a.tagName.localeCompare(b.tagName));

    return { specials, groups };
  }, [steps]);

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Debug — Tag total math
        </p>
        <p className="font-mono text-xs text-zinc-600">
          Layer A base (dependency-scaled) → Keyflare Harmony →
          Keyflare→Create.Posse → team Max HP → Base Tentacle Damage →
          interaction ops by modifier layer (pre_add → add → post_add;
          unique_scaling local layer wins; invent/patch/base_stat) →
          × hitCount (instances × copies) → special conversions → totals.
          Multiply ops ceil after each write. Restricted ops only appear when
          leaf matches. Base/op lines are single-hit; hitCount multiplies after.
        </p>
      </div>

      <div className="max-h-[420px] space-y-4 overflow-y-auto rounded border border-border bg-white p-3 font-mono text-xs text-zinc-600">
        {groups.length === 0 && specials.length === 0 ? (
          <p className="text-zinc-400">No tag total math for this team.</p>
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
              <div key={group.tagId} className="space-y-2">
                <p className="text-sm font-medium text-zinc-700">
                  {group.tagName}
                </p>

                {group.subjects.length === 0 ? (
                  <ul className="space-y-0.5 border-l border-zinc-200 pl-2">
                    <li className="text-zinc-400">
                      (no base/op steps; total from special or pool only)
                    </li>
                  </ul>
                ) : (
                  <div className="space-y-3">
                    {group.subjects.map((block) => {
                      const contribution = subjectContribution(block);
                      return (
                        <div
                          key={`${group.tagId}-${block.subjectKey}`}
                          className="space-y-0.5 border-l border-zinc-200 pl-2"
                        >
                          <p className="font-medium text-zinc-700">
                            {formatSourceLabel(block.subjectLabel, nameById)}
                          </p>
                          <ul className="space-y-0.5 pl-2">
                            {block.bases.map((b, i) => (
                              <li key={`base-${block.subjectKey}-${i}`}>
                                base |{" "}
                                {formatSourceLabel(b.sourceLabel, nameById)} | +
                                {formatNum(b.scalar)}
                                {b.rawScalar !== b.scalar
                                  ? ` (raw ${formatNum(b.rawScalar)} → effective)`
                                  : ""}
                              </li>
                            ))}
                            {block.ops.map((op, i) => (
                              <li key={`op-${block.subjectKey}-${i}`}>
                                {formatOpLine(op, nameById)}
                              </li>
                            ))}
                            {block.hitCounts.map((h, i) => (
                              <li key={`hitCount-${block.subjectKey}-${i}`}>
                                × hitCount {formatNum(h.hitCount)} ({h.detail}){" "}
                                | {formatSourceLabel(h.sourceLabel, nameById)} |{" "}
                                {formatNum(h.finishedOnce)} →{" "}
                                {formatNum(h.after)}
                              </li>
                            ))}
                            {block.bases.length === 0 &&
                              block.ops.length === 0 &&
                              block.hitCounts.length === 0 && (
                                <li className="text-zinc-400">
                                  (no base/op steps; total from special or pool
                                  only)
                                </li>
                              )}
                            <li className="pt-0.5 text-zinc-700">
                              contribution ={" "}
                              {contribution != null
                                ? formatNum(contribution)
                                : "—"}
                            </li>
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="pt-0.5 font-medium text-zinc-800">
                  Tag total ={" "}
                  {group.total != null ? formatNum(group.total) : "—"}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
