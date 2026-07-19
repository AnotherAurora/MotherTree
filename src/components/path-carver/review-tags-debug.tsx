"use client";

import { useMemo } from "react";
import {
  evaluateManifestationApply,
  type ManifestationApplyContext,
} from "@/lib/path-carver/manifestation-apply";
import type { Manifestation, TeamData } from "@/lib/team-data/types";
import type { SlotState } from "@/lib/simulator/types";

type ReviewTagsDebugProps = {
  teamData: TeamData;
  slots: SlotState[];
  applyContext: ManifestationApplyContext;
};

type AwakenerGroup = {
  slotIndex: number;
  awakenerId: number;
  awakenerName: string;
  awakenerTags: Manifestation[];
  covenantTags: Manifestation[];
  wheelTags: Manifestation[];
};

function formatCell(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function formatRequiredRealm(m: Manifestation): string {
  if (m.requiredRealm != null && m.requiredRealm2 != null) {
    return `${m.requiredRealm}|${m.requiredRealm2}`;
  }
  return formatCell(m.requiredRealm ?? m.requiredRealm2);
}

function formatRequiredAwakener(m: Manifestation): string {
  if (m.requiredAwakenerName != null && m.requiredAwakenerName !== "") {
    return m.requiredAwakenerName;
  }
  if (m.requiredAwakenerId != null) return `#${m.requiredAwakenerId}`;
  return "—";
}

function formatMetadata(metadata: string | null): string {
  if (metadata == null || metadata.trim() === "") return "—";
  return metadata;
}

function ManifestationTable({
  tags,
  applyContext,
}: {
  tags: Manifestation[];
  applyContext: ManifestationApplyContext;
}) {
  if (tags.length === 0) {
    return <p className="text-zinc-400">None</p>;
  }

  const rows = [...tags]
    .map((m) => ({
      m,
      ...evaluateManifestationApply(m, applyContext),
    }))
    .sort((a, b) => Number(b.applied) - Number(a.applied));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wide text-zinc-500">
            <th className="px-2 py-1.5 font-medium">Tag</th>
            <th className="px-2 py-1.5 font-medium">Scalar</th>
            <th className="px-2 py-1.5 font-medium">Applied</th>
            <th className="px-2 py-1.5 font-medium">Reason</th>
            <th className="px-2 py-1.5 font-medium">Metadata</th>
            <th className="px-2 py-1.5 font-medium">source_type</th>
            <th className="px-2 py-1.5 font-medium">target_type</th>
            <th className="px-2 py-1.5 font-medium">
              buff_target_type_restriction
            </th>
            <th className="px-2 py-1.5 font-medium">required_realm</th>
            <th className="px-2 py-1.5 font-medium">required_awakener</th>
            <th className="px-2 py-1.5 font-medium">dependency_stat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, applied, reason }) => {
            return (
              <tr
                key={`${m.sourceKind}-${m.id}`}
                className="border-b border-zinc-100 last:border-0"
              >
                <td className="px-2 py-1.5 text-zinc-700">{m.tagName}</td>
                <td className="px-2 py-1.5 tabular-nums">
                  {formatCell(m.valueScalar)}
                </td>
                <td
                  className={
                    applied
                      ? "px-2 py-1.5 text-emerald-700"
                      : "px-2 py-1.5 text-amber-700"
                  }
                >
                  {applied ? "yes" : "no"}
                </td>
                <td className="px-2 py-1.5 text-zinc-500">
                  {applied ? "—" : (reason ?? "—")}
                </td>
                <td
                  className="max-w-[180px] truncate px-2 py-1.5"
                  title={formatMetadata(m.metadata)}
                >
                  {formatMetadata(m.metadata)}
                </td>
                <td className="px-2 py-1.5">{formatCell(m.sourceType)}</td>
                <td className="px-2 py-1.5">{formatCell(m.targetType)}</td>
                <td className="px-2 py-1.5">
                  {formatCell(m.buffTargetTypeRestriction)}
                </td>
                <td className="px-2 py-1.5">{formatRequiredRealm(m)}</td>
                <td className="px-2 py-1.5">{formatRequiredAwakener(m)}</td>
                <td className="px-2 py-1.5">{formatCell(m.dependencyStat)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SourceSubsection({
  title,
  tags,
  applyContext,
}: {
  title: string;
  tags: Manifestation[];
  applyContext: ManifestationApplyContext;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <ManifestationTable tags={tags} applyContext={applyContext} />
    </div>
  );
}

export function ReviewTagsDebug({
  teamData,
  slots,
  applyContext,
}: ReviewTagsDebugProps) {
  const awakenerNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const awakener of teamData.awakeners) {
      map.set(awakener.id, awakener.name ?? `#${awakener.id}`);
    }
    return map;
  }, [teamData.awakeners]);

  const groups = useMemo((): AwakenerGroup[] => {
    const result: AwakenerGroup[] = [];

    for (const [slotIndex, slot] of slots.entries()) {
      if (slot.awakenerId == null) continue;

      const awakenerId = slot.awakenerId;
      const awakenerTags: Manifestation[] = [];
      const covenantTags: Manifestation[] = [];
      const wheelTags: Manifestation[] = [];

      for (const m of teamData.manifestations) {
        if (m.sourceKind === "posse") continue;

        if (m.sourceKind === "awakener" && m.awakenerId === awakenerId) {
          awakenerTags.push(m);
        } else if (m.sourceKind === "covenant" && m.slotIndex === slotIndex) {
          covenantTags.push(m);
        } else if (m.sourceKind === "wheel" && m.slotIndex === slotIndex) {
          wheelTags.push(m);
        }
      }

      result.push({
        slotIndex,
        awakenerId,
        awakenerName: awakenerNameById.get(awakenerId) ?? `#${awakenerId}`,
        awakenerTags,
        covenantTags,
        wheelTags,
      });
    }

    return result;
  }, [slots, teamData.manifestations, awakenerNameById]);

  const posseTags = useMemo(
    () => teamData.manifestations.filter((m) => m.sourceKind === "posse"),
    [teamData.manifestations],
  );

  const teamRealmList = useMemo(
    () => [...applyContext.teamRealms].sort().join(", ") || "none",
    [applyContext.teamRealms],
  );

  const damageDealerList = useMemo(() => {
    const names: string[] = [];
    for (const id of applyContext.damageDealerAwakenerIds) {
      names.push(awakenerNameById.get(id) ?? `#${id}`);
    }
    return names.sort().join(", ") || "none";
  }, [applyContext.damageDealerAwakenerIds, awakenerNameById]);

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Debug — team manifestations
        </p>
        <p className="font-mono text-xs text-zinc-600">
          Awakeners: {teamData.summary.awakenerCount} | Manifestations:{" "}
          {teamData.summary.manifestationCount} | Awakener:{" "}
          {teamData.summary.awakenerManifestationCount} | Posse:{" "}
          {teamData.summary.posseManifestationCount} | Wheel:{" "}
          {teamData.summary.wheelManifestationCount} | Covenant:{" "}
          {teamData.summary.covenantManifestationCount}
          {" | "}
          Team realms: {teamRealmList}
          {" | "}
          Chaos-only team: {applyContext.teamIsChaosOnly ? "yes" : "no"}
          {" | "}
          Damage dealers: {damageDealerList}
        </p>
      </div>

      <div className="max-h-[420px] space-y-4 overflow-y-auto rounded border border-border bg-white p-3 font-mono text-xs text-zinc-600">
        {groups.length === 0 ? (
          <p className="text-zinc-400">No awakeners on this team.</p>
        ) : (
          groups.map((group) => (
            <div key={`slot-${group.slotIndex}`} className="space-y-3">
              <p className="text-sm font-medium text-zinc-700">
                Awakener: {group.awakenerName} (Slot {group.slotIndex + 1})
              </p>
              <div className="space-y-3 border-l border-zinc-200 pl-2">
                <SourceSubsection
                  title="Awakener tags"
                  tags={group.awakenerTags}
                  applyContext={applyContext}
                />
                <SourceSubsection
                  title="Covenant tags"
                  tags={group.covenantTags}
                  applyContext={applyContext}
                />
                <SourceSubsection
                  title="Wheel tags"
                  tags={group.wheelTags}
                  applyContext={applyContext}
                />
              </div>
            </div>
          ))
        )}

        <div className="space-y-3 border-t border-zinc-200 pt-3">
          <p className="text-sm font-medium text-zinc-700">Posse tags</p>
          <div className="pl-2">
            <ManifestationTable tags={posseTags} applyContext={applyContext} />
          </div>
        </div>
      </div>
    </div>
  );
}
