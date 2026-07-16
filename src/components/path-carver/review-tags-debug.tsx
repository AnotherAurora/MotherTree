"use client";

import { useMemo } from "react";
import type { Manifestation, TeamData } from "@/lib/team-data/types";
import type { SlotState } from "@/lib/simulator/types";

type ReviewTagsDebugProps = {
  teamData: TeamData;
  slots: SlotState[];
};

type AwakenerGroup = {
  slotIndex: number;
  awakenerId: number;
  awakenerName: string;
  awakenerTags: Manifestation[];
  covenantTags: Manifestation[];
  wheelTags: Manifestation[];
};

function formatTagLine(m: Manifestation): string {
  const scalar = m.valueScalar ?? "—";
  return `${m.tagName} · scalar=${scalar}`;
}

function TagList({ tags }: { tags: Manifestation[] }) {
  if (tags.length === 0) {
    return <p className="text-zinc-400">None</p>;
  }

  return (
    <ul className="space-y-1">
      {tags.map((m) => (
        <li key={`${m.sourceKind}-${m.id}`}>{formatTagLine(m)}</li>
      ))}
    </ul>
  );
}

function SourceSubsection({
  title,
  tags,
}: {
  title: string;
  tags: Manifestation[];
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <TagList tags={tags} />
    </div>
  );
}

export function ReviewTagsDebug({ teamData, slots }: ReviewTagsDebugProps) {
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
        awakenerName:
          awakenerNameById.get(awakenerId) ?? `#${awakenerId}`,
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

  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 space-y-4">
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
        </p>
      </div>

      <div className="max-h-[420px] overflow-y-auto space-y-4 rounded border border-border bg-white p-3 font-mono text-xs text-zinc-600">
        {groups.length === 0 ? (
          <p className="text-zinc-400">No awakeners on this team.</p>
        ) : (
          groups.map((group) => (
            <div key={`slot-${group.slotIndex}`} className="space-y-3">
              <p className="text-sm font-medium text-zinc-700">
                Awakener: {group.awakenerName} (Slot {group.slotIndex + 1})
              </p>
              <div className="space-y-3 pl-2 border-l border-zinc-200">
                <SourceSubsection
                  title="Awakener tags"
                  tags={group.awakenerTags}
                />
                <SourceSubsection
                  title="Covenant tags"
                  tags={group.covenantTags}
                />
                <SourceSubsection title="Wheel tags" tags={group.wheelTags} />
              </div>
            </div>
          ))
        )}

        <div className="space-y-3 border-t border-zinc-200 pt-3">
          <p className="text-sm font-medium text-zinc-700">Posse tags</p>
          <div className="pl-2">
            <TagList tags={posseTags} />
          </div>
        </div>
      </div>
    </div>
  );
}
