"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ForeignKeyCombobox } from "@/components/admin/foreign-key-combobox";
import { getDesires, type DesireSummary } from "@/lib/actions/simulator-flow";
import type { SimulatorAwakenerOption } from "@/lib/actions/simulator";

type StartFlowModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  awakenerOptions: SimulatorAwakenerOption[];
  onConfirm: (startAwakenerId: number, desireId: number) => void;
  loading: boolean;
};

export function StartFlowModal({
  open,
  onOpenChange,
  awakenerOptions,
  onConfirm,
  loading,
}: StartFlowModalProps) {
  const [step, setStep] = useState<"awakener" | "desire">("awakener");
  const [startAwakenerId, setStartAwakenerId] = useState<number | null>(null);
  const [desires, setDesires] = useState<DesireSummary[]>([]);
  const [desiresError, setDesiresError] = useState<string | null>(null);
  const [loadingDesires, setLoadingDesires] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("awakener");
      setStartAwakenerId(null);
      setDesires([]);
      setDesiresError(null);
    }
  }, [open]);

  useEffect(() => {
    if (step !== "desire" || desires.length > 0 || loadingDesires) return;

    setLoadingDesires(true);
    getDesires().then((result) => {
      setLoadingDesires(false);
      if (result.success) {
        setDesires(result.data);
        setDesiresError(null);
      } else {
        setDesires([]);
        setDesiresError(result.error);
      }
    });
  }, [step, desires.length, loadingDesires]);

  function handleAwakenerNext() {
    if (startAwakenerId == null) return;
    setStep("desire");
  }

  function handleSelectDesire(desireId: number) {
    if (startAwakenerId == null || loading) return;
    onConfirm(startAwakenerId, desireId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {step === "awakener" ? "Select starting awakener" : "Select path"}
          </DialogTitle>
          <DialogDescription>
            {step === "awakener"
              ? "Choose the awakener that starts this simulation run."
              : "Choose a desire path. The team will be cleared and regenerated."}
          </DialogDescription>
        </DialogHeader>

        {step === "awakener" ? (
          <div className="space-y-4">
            <ForeignKeyCombobox
              value={startAwakenerId}
              onChange={setStartAwakenerId}
              options={awakenerOptions}
              placeholder="Select awakener..."
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAwakenerNext}
                disabled={startAwakenerId == null || loading}
              >
                Next
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {loadingDesires ? (
              <p className="text-sm text-zinc-500">Loading desires...</p>
            ) : desiresError ? (
              <p className="text-sm text-red-600">{desiresError}</p>
            ) : desires.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No desires found. Run{" "}
                <code className="rounded bg-zinc-100 px-1">npm run db:seed-simulator</code>{" "}
                first.
              </p>
            ) : (
              <div className="max-h-[320px] space-y-2 overflow-y-auto">
                {desires.map((desire) => (
                  <button
                    key={desire.id}
                    type="button"
                    onClick={() => handleSelectDesire(desire.id)}
                    disabled={loading}
                    className="w-full rounded-lg border border-border bg-white p-3 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <p className="font-medium text-zinc-950">{desire.name}</p>
                    {desire.description ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        {desire.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-zinc-400">
                      {desire.demandCount} demand
                      {desire.demandCount === 1 ? "" : "s"}
                    </p>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("awakener")}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
