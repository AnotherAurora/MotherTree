"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type {
  DraftDemandSelection,
  EditableDemand,
  SaveDemandInput,
} from "@/lib/path-carver/types";

type DemandFormValues = {
  tagId: number;
  tagName: string;
  targetValue: number;
  basePriorityWeight: number;
  curve: "linear" | "logarithmic" | "exponential";
  decayRate: number;
};

type ReviewDemandsStepProps = {
  mode: "create" | "edit";
  newSelections: DraftDemandSelection[];
  existingDemands: EditableDemand[];
  newDemandForms: DemandFormValues[];
  onNewDemandFormsChange: (forms: DemandFormValues[]) => void;
  onExistingDemandChange: (id: number, updates: Partial<EditableDemand>) => void;
  onDeleteExistingDemand: (id: number) => void;
};

const CURVE_OPTIONS = [
  { value: "linear", label: "Linear" },
  { value: "logarithmic", label: "Logarithmic" },
  { value: "exponential", label: "Exponential" },
] as const;

function DemandFormRow({
  tagName,
  values,
  onChange,
  onDelete,
  deleteLabel = "Remove",
}: {
  tagName: string;
  values: DemandFormValues;
  onChange: (updates: Partial<DemandFormValues>) => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-zinc-900">{tagName}</p>
        {onDelete && (
          <Button type="button" variant="outline" size="sm" onClick={onDelete}>
            {deleteLabel}
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Target value</Label>
          <Input
            type="number"
            step="any"
            min={0}
            value={values.targetValue}
            onChange={(e) =>
              onChange({ targetValue: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Base priority weight *</Label>
          <Input
            type="number"
            step="any"
            min={0}
            value={values.basePriorityWeight}
            onChange={(e) =>
              onChange({
                basePriorityWeight: parseFloat(e.target.value) || 0,
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Curve *</Label>
          <select
            value={values.curve}
            onChange={(e) =>
              onChange({
                curve: e.target.value as DemandFormValues["curve"],
              })
            }
            className="flex h-9 w-full rounded-md border border-border bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            {CURVE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Decay rate *</Label>
          <Input
            type="number"
            step="any"
            min={0}
            value={values.decayRate}
            onChange={(e) =>
              onChange({ decayRate: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
      </div>
    </div>
  );
}

export function ReviewDemandsStep({
  mode,
  newSelections,
  existingDemands,
  newDemandForms,
  onNewDemandFormsChange,
  onExistingDemandChange,
  onDeleteExistingDemand,
}: ReviewDemandsStepProps) {
  const activeExisting = existingDemands.filter((d) => !d.markedForDelete);

  function updateNewForm(index: number, updates: Partial<DemandFormValues>) {
    const next = [...newDemandForms];
    next[index] = { ...next[index], ...updates };
    onNewDemandFormsChange(next);
  }

  return (
    <div className="space-y-6">
      {mode === "edit" && activeExisting.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800">
            Existing demands
          </h3>
          {activeExisting.map((demand) => (
            <DemandFormRow
              key={demand.id}
              tagName={demand.tagName}
              values={{
                tagId: demand.tagId,
                tagName: demand.tagName,
                targetValue: demand.targetValue,
                basePriorityWeight: demand.basePriorityWeight,
                curve: demand.curve ?? "logarithmic",
                decayRate: demand.decayRate,
              }}
              onChange={(updates) => onExistingDemandChange(demand.id, updates)}
              onDelete={() => onDeleteExistingDemand(demand.id)}
              deleteLabel="Delete"
            />
          ))}
        </div>
      )}

      {newSelections.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800">
            {mode === "edit" ? "New demands" : "Demands"}
          </h3>
          {newDemandForms.map((form, index) => (
            <DemandFormRow
              key={form.tagId}
              tagName={form.tagName}
              values={form}
              onChange={(updates) => updateNewForm(index, updates)}
            />
          ))}
        </div>
      )}

      {activeExisting.length === 0 && newSelections.length === 0 && (
        <p className="text-sm text-zinc-500">
          No demands to configure. Go back and select tags on Review Tags.
        </p>
      )}
    </div>
  );
}

export function buildNewDemandForms(
  selections: DraftDemandSelection[],
): DemandFormValues[] {
  return selections.map((s) => ({
    tagId: s.tagId,
    tagName: s.tagName,
    targetValue: s.targetValue,
    basePriorityWeight: 1,
    curve: "logarithmic",
    decayRate: 1,
  }));
}

export function buildSaveDemands(
  existingDemands: EditableDemand[],
  newDemandForms: DemandFormValues[],
): SaveDemandInput[] {
  const existing = existingDemands
    .filter((d) => !d.markedForDelete)
    .map((d) => ({
      id: d.id,
      tagId: d.tagId,
      targetValue: d.targetValue,
      basePriorityWeight: d.basePriorityWeight,
      curve: (d.curve ?? "logarithmic") as SaveDemandInput["curve"],
      decayRate: d.decayRate,
    }));

  const newDemands = newDemandForms.map((f) => ({
    tagId: f.tagId,
    targetValue: f.targetValue,
    basePriorityWeight: f.basePriorityWeight,
    curve: f.curve,
    decayRate: f.decayRate,
  }));

  return [...existing, ...newDemands];
}

export function useReviewDemandsValid(
  existingDemands: EditableDemand[],
  newDemandForms: DemandFormValues[],
): boolean {
  return useMemo(() => {
    const demands = buildSaveDemands(existingDemands, newDemandForms);
    if (demands.length === 0) return false;

    const tagIds = new Set<number>();
    for (const d of demands) {
      if (d.targetValue <= 0 || d.basePriorityWeight <= 0 || d.decayRate <= 0) {
        return false;
      }
      if (tagIds.has(d.tagId)) return false;
      tagIds.add(d.tagId);
    }
    return true;
  }, [existingDemands, newDemandForms]);
}

export type { DemandFormValues };
