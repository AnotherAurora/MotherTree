"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReviewTagsBaseStatsDebug } from "@/components/path-carver/review-tags-base-stats-debug";
import { ReviewTagsDebug } from "@/components/path-carver/review-tags-debug";
import { ReviewTagsMathDebug } from "@/components/path-carver/review-tags-math-debug";
import { ReviewTagsTeamMaxHpDebug } from "@/components/path-carver/review-tags-team-max-hp-debug";
import { loadTeamData } from "@/lib/actions/team-data";
import type { TeamData } from "@/lib/team-data/types";
import {
  computeReviewTagTotals,
  getScalarForTag,
} from "@/lib/path-carver/aggregate-tag-scalars";
import type { ScalarMathStep } from "@/lib/path-carver/apply-interactions";
import type { TeamMaxHpResult } from "@/lib/path-carver/team-max-hp";
import { createManifestationApplyContext } from "@/lib/path-carver/manifestation-apply";
import type {
  AnchoredAwakenerState,
  DraftDemandSelection,
  EditableDemand,
  ManifestedTagRow,
} from "@/lib/path-carver/types";
import type { SlotState } from "@/lib/simulator/types";

type ReviewTagsStepProps = {
  slots: SlotState[];
  posseId: number | null;
  anchoredAwakeners: AnchoredAwakenerState[];
  desireName: string;
  desireDescription: string;
  mode: "create" | "edit";
  selections: DraftDemandSelection[];
  existingDemands: EditableDemand[];
  onDesireNameChange: (value: string) => void;
  onDesireDescriptionChange: (value: string) => void;
  onSelectionsChange: (selections: DraftDemandSelection[]) => void;
};

export function ReviewTagsStep({
  slots,
  posseId,
  anchoredAwakeners,
  desireName,
  desireDescription,
  mode,
  selections,
  existingDemands,
  onDesireNameChange,
  onDesireDescriptionChange,
  onSelectionsChange,
}: ReviewTagsStepProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manifestedTags, setManifestedTags] = useState<ManifestedTagRow[]>([]);
  const [scalarTotals, setScalarTotals] = useState<Map<number, number>>(
    new Map(),
  );
  const [mathSteps, setMathSteps] = useState<ScalarMathStep[]>([]);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [triggerCounts, setTriggerCounts] = useState<Map<number, number>>(
    () => new Map(),
  );
  const [teamMaxHp, setTeamMaxHp] = useState<TeamMaxHpResult | null>(null);

  const damageDealerAwakenerIds = useMemo(() => {
    const ids: number[] = [];
    for (const anchor of anchoredAwakeners) {
      if (anchor.isDamageDealer) ids.push(anchor.awakenerId);
    }
    return ids;
  }, [anchoredAwakeners]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadTeamData({
      slots: slots.map((s) => ({
        awakenerId: s.awakenerId,
        covenantId: s.covenantId,
        covenantStatSetId: s.covenantStatSetId,
        wheel1Id: s.wheel1Id,
        wheel2Id: s.wheel2Id,
      })),
      posseId,
    }).then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.success) {
        setError(result.error);
        setManifestedTags([]);
        setScalarTotals(new Map());
        setMathSteps([]);
        setTeamData(null);
        setTriggerCounts(new Map());
        setTeamMaxHp(null);
        return;
      }

      const applyContext = createManifestationApplyContext(
        result.data.awakeners,
        damageDealerAwakenerIds,
        new Map(),
        result.data.realms,
        result.data.manifestations,
      );
      const {
        totalsByTagId,
        steps,
        reviewTeamData,
        triggerCounts: counts,
        teamMaxHp: hp,
      } = computeReviewTagTotals(result.data, applyContext);
      setTeamData(reviewTeamData);
      setScalarTotals(totalsByTagId);
      setMathSteps(steps);
      setTriggerCounts(counts);
      setTeamMaxHp(hp);

      const tagRows: ManifestedTagRow[] = [];

      for (const [tagId, scalarSum] of totalsByTagId) {
        if (scalarSum === 0) continue;
        const tag = reviewTeamData.tagsById[tagId];
        const manifestation = reviewTeamData.manifestations.find(
          (m) => m.tagId === tagId,
        );
        tagRows.push({
          tagId,
          tagName: tag?.tagName ?? manifestation?.tagName ?? "Unknown",
          scalarSum,
        });
      }

      tagRows.sort((a, b) => a.tagName.localeCompare(b.tagName));
      setManifestedTags(tagRows);

      const visibleTagIds = new Set(tagRows.map((t) => t.tagId));
      const pruned = selections.filter((s) => visibleTagIds.has(s.tagId));
      if (pruned.length !== selections.length) {
        onSelectionsChange(pruned);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [slots, posseId, damageDealerAwakenerIds, onSelectionsChange]);

  const selectedIds = useMemo(
    () => new Set(selections.map((s) => s.tagId)),
    [selections],
  );

  const applyContext = useMemo(() => {
    if (!teamData) return null;
    return createManifestationApplyContext(
      teamData.awakeners,
      damageDealerAwakenerIds,
      triggerCounts,
      teamData.realms,
      teamData.manifestations,
    );
  }, [teamData, damageDealerAwakenerIds, triggerCounts]);

  function toggleTag(tag: ManifestedTagRow) {
    if (selectedIds.has(tag.tagId)) {
      onSelectionsChange(selections.filter((s) => s.tagId !== tag.tagId));
    } else {
      onSelectionsChange([
        ...selections,
        {
          tagId: tag.tagId,
          tagName: tag.tagName,
          targetValue: getScalarForTag(scalarTotals, tag.tagId),
        },
      ]);
    }
  }

  const activeExisting = existingDemands.filter((d) => !d.markedForDelete);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="desire-name">Desire name *</Label>
          <Input
            id="desire-name"
            value={desireName}
            onChange={(e) => onDesireNameChange(e.target.value)}
            placeholder="e.g. Strike DPS"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="desire-description">Description</Label>
          <Textarea
            id="desire-description"
            value={desireDescription}
            onChange={(e) => onDesireDescriptionChange(e.target.value)}
            placeholder="Optional description..."
            rows={3}
          />
        </div>
      </div>

      {mode === "edit" && activeExisting.length > 0 && (
        <div className="rounded-lg border border-border bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-700">Existing demands</p>
          <p className="mt-1 text-xs text-zinc-500">
            These are saved on Review Demands. Select additional tags below to
            add new demands.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600">
            {activeExisting.map((d) => (
              <li key={d.id}>• {d.tagName}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <Label>Manifested tags — select core demands</Label>
        {loading && (
          <p className="text-sm text-zinc-500">Loading team manifestations...</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 w-10" />
                  <th className="px-3 py-2">Tag</th>
                  <th className="px-3 py-2 text-right">Scalar sum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {manifestedTags.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-zinc-500">
                      No manifested tags for this team.
                    </td>
                  </tr>
                ) : (
                  manifestedTags.map((tag) => {
                    const checked = selectedIds.has(tag.tagId);

                    return (
                      <tr key={tag.tagId} className="hover:bg-zinc-50">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTag(tag)}
                            className="h-4 w-4 rounded border-zinc-300"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-zinc-800">
                          {tag.tagName}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                          {tag.scalarSum.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && teamData && applyContext && (
        <>
          <ReviewTagsDebug
            teamData={teamData}
            slots={slots}
            applyContext={applyContext}
            teamMaxHp={teamMaxHp?.finalMaxHp ?? null}
          />
          <ReviewTagsMathDebug
            steps={mathSteps}
            awakeners={teamData.awakeners}
          />
          <ReviewTagsBaseStatsDebug awakeners={teamData.awakeners} />
          {teamMaxHp && <ReviewTagsTeamMaxHpDebug teamMaxHp={teamMaxHp} />}
        </>
      )}
    </div>
  );
}
