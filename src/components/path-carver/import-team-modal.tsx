"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { importIngameTeamCode, type ImportTeamResult } from "@/lib/actions/path-carver";
import { MAX_WRAPPED_INGAME_CODE_LENGTH } from "@/lib/team-import/extract-ingame-code";

type ImportTeamModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (result: ImportTeamResult) => void;
  importing: boolean;
  onImportingChange: (importing: boolean) => void;
};

export function ImportTeamModal({
  open,
  onOpenChange,
  onImport,
  importing,
  onImportingChange,
}: ImportTeamModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setCode("");
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit() {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Paste an in-game team code first.");
      return;
    }
    if (trimmed.length > MAX_WRAPPED_INGAME_CODE_LENGTH) {
      setError("Import code is too long.");
      return;
    }

    onImportingChange(true);
    setError(null);

    const result = await importIngameTeamCode(trimmed);
    onImportingChange(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onImport(result.data);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import team</DialogTitle>
          <DialogDescription>
            Paste an in-game <code className="text-xs">@@...@@</code> code or
            full share text. Wheel mappings may be incomplete for some codes.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Paste import code here"
          rows={5}
          disabled={importing}
          className="font-mono text-sm"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={importing}>
            {importing ? "Importing..." : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
