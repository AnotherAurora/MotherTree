"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BanListPanel } from "@/components/simulator/ban-list-panel";
import { RadarChart } from "@/components/simulator/radar-chart";
import type { TeamData } from "@/lib/actions/team-data";
import type { SimulatorAwakenerOption } from "@/lib/actions/simulator";
import type {
  BanEntry,
  SimulatorGearOptions,
} from "@/lib/actions/simulator-flow";
import type { FulfillmentResult } from "@/lib/simulator/fulfillment";

type SimulatorSidebarProps = {
  banList: BanEntry[];
  awakenerOptions: SimulatorAwakenerOption[];
  gearOptions: SimulatorGearOptions;
  onAddBan: (entry: BanEntry) => void;
  onRemoveBan: (entry: BanEntry) => void;
  onClearAllBans: () => void;
  teamData: TeamData | null;
  teamDataError: string | null;
  fulfillment: FulfillmentResult | null;
  bannedEntityCount: number;
};

function formatManifestationLine(
  manifestation: TeamData["manifestations"][number],
  awakenerName: string,
): string {
  const scalar = manifestation.valueScalar ?? "—";
  const source = manifestation.sourceKind;
  const slot =
    manifestation.slotIndex != null ? `slot${manifestation.slotIndex + 1}` : "—";
  return `${source} · ${awakenerName} · ${manifestation.tagName} · scalar=${scalar} · ${slot}`;
}

export function SimulatorSidebar({
  banList,
  awakenerOptions,
  gearOptions,
  onAddBan,
  onRemoveBan,
  onClearAllBans,
  teamData,
  teamDataError,
  fulfillment,
  bannedEntityCount,
}: SimulatorSidebarProps) {
  const awakenerNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const option of awakenerOptions) {
      map.set(option.value, option.label);
    }
    if (teamData) {
      for (const awakener of teamData.awakeners) {
        map.set(awakener.id, awakener.name ?? `#${awakener.id}`);
      }
    }
    return map;
  }, [awakenerOptions, teamData]);

  const manifestationLines = useMemo(() => {
    if (!teamData) return [];
    return teamData.manifestations.map((manifestation) =>
      formatManifestationLine(
        manifestation,
        manifestation.awakenerId != null
          ? (awakenerNameById.get(manifestation.awakenerId) ??
              `#${manifestation.awakenerId}`)
          : "team",
      ),
    );
  }, [teamData, awakenerNameById]);

  const radarAxes = useMemo(() => {
    if (!fulfillment) return [];
    return fulfillment.demands.map((d) => ({
      label: d.tagName,
      value: d.fulfillmentPct,
    }));
  }, [fulfillment]);

  const summaryLines = useMemo(() => {
    if (!fulfillment) {
      return ["Select a path and load team data to see fulfillment."];
    }
    return [
      ...fulfillment.summaryLines,
      `Banned entities in list: ${bannedEntityCount}`,
    ];
  }, [fulfillment, bannedEntityCount]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Team Data</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[220px] min-h-[120px] overflow-y-auto rounded-lg border border-border bg-zinc-50 p-3">
            {teamDataError ? (
              <p className="text-sm text-red-600">{teamDataError}</p>
            ) : teamData ? (
              <div className="space-y-2 font-mono text-xs text-zinc-600">
                <p>
                  Awakeners: {teamData.summary.awakenerCount} | Manifestations:{" "}
                  {teamData.summary.manifestationCount} | Awakener:{" "}
                  {teamData.summary.awakenerManifestationCount} | Posse:{" "}
                  {teamData.summary.posseManifestationCount} | Wheel:{" "}
                  {teamData.summary.wheelManifestationCount} | Covenant:{" "}
                  {teamData.summary.covenantManifestationCount}
                </p>
                {manifestationLines.length > 0 ? (
                  <ul className="space-y-1.5">
                    {manifestationLines.map((line, index) => (
                      <li key={`${line}-${index}`}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-zinc-400">No manifestations loaded</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                Select awakeners, then load team data
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Radar Chart</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[220px] items-center justify-center pt-0">
          <RadarChart axes={radarAxes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Summary and Calculation List
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[200px] min-h-[200px] overflow-y-auto rounded-lg border border-border bg-zinc-50 p-3">
            <ul className="space-y-2 font-mono text-xs text-zinc-600">
              {summaryLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-1 flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Ban List</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <BanListPanel
            banList={banList}
            awakenerOptions={awakenerOptions}
            gearOptions={gearOptions}
            onAdd={onAddBan}
            onRemove={onRemoveBan}
            onClearAll={onClearAllBans}
          />
        </CardContent>
      </Card>
    </div>
  );
}
