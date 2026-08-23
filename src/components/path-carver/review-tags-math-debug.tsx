"use client";

import { useMemo } from "react";
import type { ScalarMathStep } from "@/lib/path-carver/apply-interactions";
import { formatSameTagScalarMerge } from "@/lib/path-carver/combine-same-tag-scalar";
import type { Awakener } from "@/lib/team-data/types";

type ReviewTagsMathDebugProps = {
  steps: ScalarMathStep[];
  awakeners: Awakener[];
};

type BaseStep = Extract<ScalarMathStep, { kind: "base" }>;
type OpStep = Extract<ScalarMathStep, { kind: "op" }>;
type HitCountStep = Extract<ScalarMathStep, { kind: "hitCount" }>;
type AftereffectStep = Extract<ScalarMathStep, { kind: "aftereffect" }>;
type SpecialStep = Extract<ScalarMathStep, { kind: "special" }>;

type SubjectMathBlock = {
  subjectKey: string;
  subjectLabel: string;
  /** First non-empty manifestation metadata for this subject. */
  metadata: string | null;
  bases: BaseStep[];
  ops: OpStep[];
  aftereffects: AftereffectStep[];
  hitCounts: HitCountStep[];
};

type TagMathGroup = {
  tagId: number;
  tagName: string;
  subjects: SubjectMathBlock[];
  total: number | null;
  isAdditive: boolean;
  isPercent: boolean;
};

/** Matches apply-interactions Option A deferred subject keys. */
const DEFERRED_CREATE_SUBJECT_KEY = "deferred-create";
const DEFERRED_STACK_AMPLIFY_SUBJECT_KEY = "deferred-stack-amplify";
const DEFERRED_AMPLIFY_SUBJECT_KEY = "deferred-amplify";

/** Matches apply-interactions hop 4d subject labels. */
const HIT_TENTACLE_SUBJECT_LABEL = "Hit = Tentacle Attack";
const TENTACLE_TDU_POOL_SUBJECT_LABEL = "Tentacle TDU pool";

function isTentacleTduPoolSubject(block: SubjectMathBlock): boolean {
  return (
    block.subjectLabel === HIT_TENTACLE_SUBJECT_LABEL ||
    block.subjectLabel === TENTACLE_TDU_POOL_SUBJECT_LABEL
  );
}

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

function formatAftereffectLine(
  step: AftereffectStep,
  nameById: Map<number, string>,
): string {
  const inventNote = step.invented ? " | invented" : "";
  const layerNote = ` | layer=${step.layer ?? "null"}`;
  const metadataNote =
    step.metadata != null && step.metadata.trim() !== ""
      ? ` ${step.metadata}`
      : "";
  return (
    `aftereffect | ${step.op} | ${step.tagName} ← finishedOnce ${formatNum(step.finishedOnce)}` +
    ` × factor ${formatNum(step.factor)} → contrib ${formatNum(step.contribution)}` +
    ` × hitCount ${formatNum(step.hitCount)} = ${formatNum(step.merged)}` +
    ` | ${formatOwner(step.owner, nameById)}` +
    ` | ${formatNum(step.before)} → ${formatNum(step.after)}` +
    `${layerNote} | targetType=${step.targetType}${inventNote}${metadataNote}`
  );
}

/** Pipeline value for a subject block (create after, amplify after, etc.). */
function subjectContribution(block: SubjectMathBlock): number | null {
  if (block.hitCounts.length > 0) {
    return block.hitCounts[block.hitCounts.length - 1]!.after;
  }
  if (block.aftereffects.length > 0) {
    return block.aftereffects.reduce((sum, a) => sum + a.merged, 0);
  }
  if (block.ops.length > 0) {
    return block.ops[block.ops.length - 1]!.after;
  }
  if (block.bases.length > 0) {
    return block.bases.reduce((sum, b) => sum + b.scalar, 0);
  }
  return null;
}

/**
 * Value committed into the tag total merge.
 * Deferred create is intermediate when amplify also ran (engine merges amplify after only).
 * When deferred stack amplify ran, it replaced the combined stack — aftereffect /
 * Layer A / other subject blocks for this tag are intermediate.
 * Hop 4d Tentacle TDU pool / Hit replaces owner Tentacle totals — Layer A /
 * Generate / RTM unit blocks are intermediate.
 */
function committedContribution(
  block: SubjectMathBlock,
  subjects: readonly SubjectMathBlock[],
): number | null {
  if (
    block.subjectKey === DEFERRED_CREATE_SUBJECT_KEY &&
    subjects.some((s) => s.subjectKey === DEFERRED_AMPLIFY_SUBJECT_KEY)
  ) {
    return null;
  }
  if (
    subjects.some((s) => s.subjectKey === DEFERRED_STACK_AMPLIFY_SUBJECT_KEY) &&
    block.subjectKey !== DEFERRED_STACK_AMPLIFY_SUBJECT_KEY
  ) {
    return null;
  }
  if (
    subjects.some(isTentacleTduPoolSubject) &&
    !isTentacleTduPoolSubject(block)
  ) {
    return null;
  }
  return subjectContribution(block);
}

function intermediateMergeVia(
  block: SubjectMathBlock,
  subjects: readonly SubjectMathBlock[],
): string {
  if (
    subjects.some(isTentacleTduPoolSubject) &&
    !isTentacleTduPoolSubject(block)
  ) {
    return "TDU pool";
  }
  if (
    subjects.some((s) => s.subjectKey === DEFERRED_STACK_AMPLIFY_SUBJECT_KEY) &&
    block.subjectKey !== DEFERRED_STACK_AMPLIFY_SUBJECT_KEY
  ) {
    return "stack amplify";
  }
  return "amplify";
}

function mergeModeLabel(isAdditive: boolean, isPercent: boolean): string {
  if (isAdditive) return "sum, is_additive=true";
  if (isPercent) return "percent ×, is_additive=false";
  return "product, is_additive=false";
}

/** Display order matches Layer B flow: subjects → stack amplify → create → Trigger. */
function subjectDisplayRank(subjectKey: string): number {
  if (subjectKey === DEFERRED_STACK_AMPLIFY_SUBJECT_KEY) return 1;
  if (subjectKey === DEFERRED_CREATE_SUBJECT_KEY) return 2;
  if (subjectKey === DEFERRED_AMPLIFY_SUBJECT_KEY) return 3;
  return 0;
}

function sortSubjectsForDisplay(
  subjects: SubjectMathBlock[],
): SubjectMathBlock[] {
  return [...subjects].sort(
    (a, b) =>
      subjectDisplayRank(a.subjectKey) - subjectDisplayRank(b.subjectKey),
  );
}

function formatSubjectHeader(
  subjectLabel: string,
  metadata: string | null,
  nameById: Map<number, string>,
): string {
  const label = formatSourceLabel(subjectLabel, nameById);
  if (metadata == null || metadata.trim() === "") return label;
  return `${label} ${metadata}`;
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
      metadata: null,
      bases: [],
      ops: [],
      aftereffects: [],
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
        isAdditive: boolean;
        isPercent: boolean;
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
          isAdditive: true,
          isPercent: false,
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
        group.isAdditive = step.isAdditive;
        group.isPercent = step.isPercent;
        continue;
      }

      const group = ensureTag(step.tagId, step.tagName);
      const block = ensureSubject(
        group.subjects,
        step.subjectKey,
        step.subjectLabel,
      );
      if (step.kind === "base") {
        block.bases.push(step);
        if (
          block.metadata == null &&
          step.metadata != null &&
          step.metadata.trim() !== ""
        ) {
          block.metadata = step.metadata;
        }
      } else if (step.kind === "op") block.ops.push(step);
      else if (step.kind === "aftereffect") {
        block.aftereffects.push(step);
        if (
          block.metadata == null &&
          step.metadata != null &&
          step.metadata.trim() !== ""
        ) {
          block.metadata = step.metadata;
        }
      } else if (step.kind === "hitCount") block.hitCounts.push(step);
    }

    const groups: TagMathGroup[] = [...byTag.values()]
      .map((g) => ({
        tagId: g.tagId,
        tagName: g.tagName,
        subjects: sortSubjectsForDisplay([...g.subjects.values()]),
        total: g.total,
        isAdditive: g.isAdditive,
        isPercent: g.isPercent,
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
          aftereffect from finishedOnce (merge contribution × hitCount;
          look-ahead defers creates_base + amplifies in the closure) →
          × hitCount (instances × copies) → Tentacle TDU pool
          (RTM / Generate / Hit × Unique+TDU+Fixed) → totals.
          Multiply ops ceil after each write. Restricted ops only appear when
          leaf matches. Base/op lines are single-hit; hitCount multiplies after.
          Same-tag merge uses tag.is_additive / tag.is_percent (percent:
          (1+a)(1+b)−1).
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
                  Special steps
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

            {groups.map((group) => {
              const parts = group.subjects
                .map((block) => committedContribution(block, group.subjects))
                .filter((v): v is number => v != null);
              const merge = formatSameTagScalarMerge(
                parts,
                group.isAdditive,
                group.isPercent,
              );

              return (
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
                        const pipeline = subjectContribution(block);
                        const committed = committedContribution(
                          block,
                          group.subjects,
                        );
                        const intermediate =
                          committed == null && pipeline != null;
                        return (
                          <div
                            key={`${group.tagId}-${block.subjectKey}`}
                            className="space-y-0.5 border-l border-zinc-200 pl-2"
                          >
                            <p className="font-medium text-zinc-700">
                              {formatSubjectHeader(
                                block.subjectLabel,
                                block.metadata,
                                nameById,
                              )}
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
                              {block.aftereffects.map((a, i) => (
                                <li key={`aftereffect-${block.subjectKey}-${i}`}>
                                  {formatAftereffectLine(a, nameById)}
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
                                block.aftereffects.length === 0 &&
                                block.hitCounts.length === 0 && (
                                  <li className="text-zinc-400">
                                    (no base/op steps; total from special or pool
                                    only)
                                  </li>
                                )}
                              <li className="pt-0.5 text-zinc-700">
                                {intermediate
                                  ? `contribution = ${formatNum(pipeline!)} (intermediate; merged via ${intermediateMergeVia(block, group.subjects)})`
                                  : `contribution = ${
                                      committed != null
                                        ? formatNum(committed)
                                        : "—"
                                    }`}
                              </li>
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {merge != null && (
                    <div className="space-y-0.5 pt-0.5 text-zinc-700">
                      <p>
                        merge ({mergeModeLabel(group.isAdditive, group.isPercent)}
                        ):
                      </p>
                      <p>{merge.detail}</p>
                    </div>
                  )}

                  <p className="pt-0.5 font-medium text-zinc-800">
                    Tag total ={" "}
                    {group.total != null ? formatNum(group.total) : "—"}
                  </p>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
