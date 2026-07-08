"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ForeignKeyCombobox } from "@/components/admin/foreign-key-combobox";
import type { SimulatorGearOptions } from "@/lib/actions/simulator-flow";
import type { WizardStep } from "@/lib/path-carver/types";
import { cn } from "@/lib/utils";

type PathCarverHeaderProps = {
  step: WizardStep;
  realm: string;
  posseId: number | null;
  gearOptions: SimulatorGearOptions;
  desireName: string;
  showDesireName: boolean;
  onPosseChange: (value: number | null) => void;
  onLoad: () => void;
  onBack: () => void;
  onNext: () => void;
  onSave: () => void;
  canAdvance: boolean;
  saving: boolean;
  loading: boolean;
};

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "build", label: "Build" },
  { key: "review1", label: "Review Tags" },
  { key: "review2", label: "Review Demands" },
];

function DisplayValue({ value }: { value: string }) {
  return (
    <p className="min-h-9 select-none text-sm leading-9 text-zinc-950">
      {value || <span className="text-zinc-400">—</span>}
    </p>
  );
}

export function PathCarverHeader({
  step,
  realm,
  posseId,
  gearOptions,
  desireName,
  showDesireName,
  onPosseChange,
  onLoad,
  onBack,
  onNext,
  onSave,
  canAdvance,
  saving,
  loading,
}: PathCarverHeaderProps) {
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        {STEPS.map((s, i) => (
          <span key={s.key} className="flex items-center gap-2">
            {i > 0 && <span className="text-zinc-300">→</span>}
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 font-medium",
                s.key === step
                  ? "bg-zinc-900 text-white"
                  : i < stepIndex
                    ? "bg-zinc-100 text-zinc-700"
                    : "text-zinc-400",
              )}
            >
              {s.label}
            </span>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[200px] space-y-3">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Realm
            </Label>
            <DisplayValue value={realm} />
          </div>
          {step === "build" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Posse
              </Label>
              <ForeignKeyCombobox
                value={posseId}
                onChange={onPosseChange}
                options={gearOptions.posse}
                placeholder="Select posse..."
              />
            </div>
          )}
          {showDesireName && step === "build" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Desire
              </Label>
              <DisplayValue value={desireName} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {step === "build" && (
            <Button type="button" variant="outline" onClick={onLoad} disabled={loading}>
              Load
            </Button>
          )}
          {step !== "build" && (
            <Button type="button" variant="outline" onClick={onBack} disabled={loading || saving}>
              Back
            </Button>
          )}
          {step !== "review2" ? (
            <Button type="button" onClick={onNext} disabled={!canAdvance || loading}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={onSave} disabled={!canAdvance || saving || loading}>
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
