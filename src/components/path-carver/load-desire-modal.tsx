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
import { getDesires, type DesireSummary } from "@/lib/actions/simulator-flow";

type LoadDesireModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (desireId: number) => void;
  loading: boolean;
};

export function LoadDesireModal({
  open,
  onOpenChange,
  onSelect,
  loading,
}: LoadDesireModalProps) {
  const [desires, setDesires] = useState<DesireSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingDesires, setLoadingDesires] = useState(false);

  useEffect(() => {
    if (!open) {
      setDesires([]);
      setError(null);
      return;
    }

    setLoadingDesires(true);
    getDesires().then((result) => {
      setLoadingDesires(false);
      if (result.success) {
        setDesires(result.data);
        setError(null);
      } else {
        setDesires([]);
        setError(result.error);
      }
    });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Load desire</DialogTitle>
          <DialogDescription>
            Select an existing desire to edit its team template, anchors, and
            demands.
          </DialogDescription>
        </DialogHeader>

        {loadingDesires && (
          <p className="text-sm text-zinc-500">Loading desires...</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loadingDesires && !error && desires.length === 0 && (
          <p className="text-sm text-zinc-500">No desires found.</p>
        )}

        <div className="space-y-2">
          {desires.map((desire) => (
            <button
              key={desire.id}
              type="button"
              disabled={loading}
              onClick={() => onSelect(desire.id)}
              className="w-full rounded-lg border border-border bg-white p-3 text-left transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              <p className="font-medium text-zinc-900">{desire.name}</p>
              {desire.description && (
                <p className="mt-0.5 text-sm text-zinc-500 line-clamp-2">
                  {desire.description}
                </p>
              )}
              <p className="mt-1 text-xs text-zinc-400">
                {desire.demandCount} demand{desire.demandCount !== 1 ? "s" : ""}
              </p>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
