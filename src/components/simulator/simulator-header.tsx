"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ForeignKeyCombobox } from "@/components/admin/foreign-key-combobox";
import { RealmDisplay } from "@/components/simulator/realm-display";
import type { SimulatorGearOptions } from "@/lib/actions/simulator-flow";

type SimulatorHeaderProps = {
  realm: string;
  posseId: number | null;
  path: string;
  gearOptions: SimulatorGearOptions;
  onPosseChange: (value: number | null) => void;
  onStart: () => void;
  onRecommend: () => void;
  onClearPath: () => void;
  onLoadTeamData: () => void;
  loadingTeamData: boolean;
  loadTeamDataDisabled: boolean;
  loadingFlow: boolean;
  recommendDisabled: boolean;
  hasSelectedDesire: boolean;
};

function DisplayValue({ value }: { value: string }) {
  return (
    <p className="min-h-9 select-none text-sm leading-9 text-zinc-950">
      {value || <span className="text-zinc-400">—</span>}
    </p>
  );
}

export function SimulatorHeader({
  realm,
  posseId,
  path,
  gearOptions,
  onPosseChange,
  onStart,
  onRecommend,
  onClearPath,
  onLoadTeamData,
  loadingTeamData,
  loadTeamDataDisabled,
  loadingFlow,
  recommendDisabled,
  hasSelectedDesire,
}: SimulatorHeaderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLoadTeamDataDisabled =
    mounted && (loadTeamDataDisabled || loadingTeamData || loadingFlow);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[200px] space-y-3">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Realm
            </Label>
            <RealmDisplay value={realm} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Posse
            </Label>
            <ForeignKeyCombobox
              value={posseId}
              onChange={onPosseChange}
              options={gearOptions.posse}
              placeholder="Select posse..."
              assetKind="posse"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={onStart} disabled={loadingFlow}>
            {loadingFlow ? "Running..." : "Start"}
          </Button>
          <Button
            size="lg"
            onClick={onRecommend}
            disabled={recommendDisabled || loadingFlow || !hasSelectedDesire}
          >
            Recommend
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={onLoadTeamData}
            disabled={isLoadTeamDataDisabled}
          >
            {loadingTeamData ? "Loading team data..." : "Load team data"}
          </Button>
        </div>

        <div className="flex min-w-[200px] flex-col gap-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={onClearPath}
              disabled={!hasSelectedDesire && !path}
            >
              Clear Path
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Path
            </Label>
            <DisplayValue value={path} />
          </div>
        </div>
      </div>
    </div>
  );
}
