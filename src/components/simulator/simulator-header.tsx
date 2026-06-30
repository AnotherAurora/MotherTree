"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EnumSelect } from "@/components/admin/enum-select";
import { POSSE_OPTIONS } from "@/components/simulator/mock-data";

type SimulatorHeaderProps = {
  realm: string;
  posse: string | null;
  path: string;
  onPosseChange: (value: string | null) => void;
  onClearPath: () => void;
  onLoadContext: () => void;
  loadingContext: boolean;
  loadContextDisabled: boolean;
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
  posse,
  path,
  onPosseChange,
  onClearPath,
  onLoadContext,
  loadingContext,
  loadContextDisabled,
}: SimulatorHeaderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLoadContextDisabled =
    mounted && (loadContextDisabled || loadingContext);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[200px] space-y-3">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Realm
            </Label>
            <DisplayValue value={realm} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Posse
            </Label>
            <EnumSelect
              value={posse}
              onChange={onPosseChange}
              options={POSSE_OPTIONS}
              placeholder="Select posse..."
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled title="Not wired yet">
            Start
          </Button>
          <Button size="lg" disabled title="Not wired yet">
            Recommend
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={onLoadContext}
            disabled={isLoadContextDisabled}
          >
            {loadingContext ? "Loading..." : "Load damage context"}
          </Button>
        </div>

        <div className="flex min-w-[200px] flex-col gap-3">
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClearPath}>
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
