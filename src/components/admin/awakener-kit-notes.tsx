"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, ChevronRight, FileText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAwakenerNotes, saveAwakenerNotes } from "@/lib/actions/kit-reader";
import { cn } from "@/lib/utils";

type AwakenerKitNotesProps = {
  awakenerId: number;
  awakenerName: string;
};

const DEBOUNCE_MS = 800;

export function AwakenerKitNotes({
  awakenerId,
  awakenerName,
}: AwakenerKitNotesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [lastSavedNotes, setLastSavedNotes] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSaving, startSaving] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"saved" | "dirty" | "saving">("saved");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentAwakenerIdRef = useRef<number>(awakenerId);
  currentAwakenerIdRef.current = awakenerId;

  // Load notes when awakener changes
  useEffect(() => {
    let cancelled = false;
    setIsInitialLoading(true);

    getAwakenerNotes(awakenerId).then((result) => {
      if (cancelled) return;
      setIsInitialLoading(false);
      if (result.success) {
        const loaded = result.data.notes ?? "";
        setNotes(loaded);
        setLastSavedNotes(loaded);
        setSaveStatus("saved");
        if (loaded.trim().length > 0) {
          setIsOpen(true);
        }
      } else {
        toast.error(`Failed to load notes: ${result.error}`);
      }
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [awakenerId]);

  const performSave = useCallback((textToSave: string, targetAwakenerId: number) => {
    setSaveStatus("saving");
    startSaving(async () => {
      const result = await saveAwakenerNotes(targetAwakenerId, textToSave);
      if (targetAwakenerId !== currentAwakenerIdRef.current) return;

      if (result.success) {
        setLastSavedNotes(textToSave);
        setSaveStatus("saved");
      } else {
        setSaveStatus("dirty");
        toast.error(`Failed to save notes: ${result.error}`);
      }
    });
  }, []);

  const handleChange = (newText: string) => {
    setNotes(newText);
    setSaveStatus("dirty");

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      performSave(newText, awakenerId);
    }, DEBOUNCE_MS);
  };

  const handleManualSave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    performSave(notes, awakenerId);
  };

  const isDirty = notes !== lastSavedNotes;

  return (
    <div className="rounded-lg border border-border bg-white shadow-xs">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className="flex cursor-pointer select-none items-center justify-between px-4 py-2.5 transition-colors hover:bg-zinc-50"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-500" />
          )}
          <FileText className="h-4 w-4 text-zinc-600" />
          <span className="text-sm font-medium text-zinc-900">
            Kit Notes &amp; Scratchpad
          </span>
          {notes.trim().length > 0 && !isOpen && (
            <span className="truncate text-xs text-zinc-500 max-w-xs sm:max-w-md">
              — {notes.trim().split("\n")[0]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isInitialLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
          ) : isSaving || saveStatus === "saving" ? (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          ) : isDirty || saveStatus === "dirty" ? (
            <span className="text-xs font-medium text-amber-600">
              Unsaved changes
            </span>
          ) : notes.trim().length > 0 ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <Check className="h-3 w-3" /> Saved
            </span>
          ) : null}
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-border p-4 space-y-2.5">
          <Textarea
            value={notes}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`Jot notes for ${awakenerName}'s kit (mechanics, skill rotations, formulas, balance reminders)...`}
            className="min-h-[120px] font-mono text-sm leading-relaxed bg-zinc-50/50 resize-y"
          />

          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Auto-saves as you type.</span>
            {isDirty && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isSaving}
                onClick={handleManualSave}
                className="h-7 px-2.5 text-xs"
              >
                <Save className="mr-1 h-3.5 w-3.5" />
                Save now
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
