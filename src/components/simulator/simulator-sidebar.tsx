"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadarChartPlaceholder } from "@/components/simulator/radar-chart-placeholder";
import { RADAR_AXES, SUMMARY_LINES } from "@/components/simulator/mock-data";

type SimulatorSidebarProps = {
  banList: string[];
  onRemoveBan: (tag: string) => void;
  onClearAllBans: () => void;
};

export function SimulatorSidebar({
  banList,
  onRemoveBan,
  onClearAllBans,
}: SimulatorSidebarProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Radar Chart</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[220px] items-center justify-center pt-0">
          <RadarChartPlaceholder axes={RADAR_AXES} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Summary and Calculation List
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[200px] min-h-[200px] overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <ul className="space-y-2 font-mono text-xs text-zinc-600">
              {SUMMARY_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-1 flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Ban List</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled title="Not wired yet">
              Add
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAllBans}
              disabled={banList.length === 0}
            >
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="min-h-[120px] overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            {banList.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {banList.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onRemoveBan(tag)}
                    className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700 transition-colors hover:bg-red-100"
                    title="Click to remove"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No banned tags</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
