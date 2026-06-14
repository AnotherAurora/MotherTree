"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DotSeparatedInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

type Segment = { id: string; value: string };

function parseSegmentValues(value: string): string[] {
  if (!value) return [""];
  return value.split(".");
}

export function DotSeparatedInput({
  value,
  onChange,
  disabled = false,
}: DotSeparatedInputProps) {
  const idCounter = React.useRef(0);
  const nextSegmentId = React.useCallback(() => {
    idCounter.current += 1;
    return String(idCounter.current);
  }, []);

  const [segments, setSegments] = React.useState<Segment[]>(() =>
    parseSegmentValues(value).map((segmentValue) => ({
      id: String((idCounter.current += 1)),
      value: segmentValue,
    })),
  );

  React.useEffect(() => {
    const values = parseSegmentValues(value);
    setSegments((prev) =>
      values.map((segmentValue, index) => ({
        id: prev[index]?.id ?? nextSegmentId(),
        value: segmentValue,
      })),
    );
  }, [value, nextSegmentId]);

  function updateSegments(next: Segment[]) {
    setSegments(next);
    onChange(next.map((segment) => segment.value).join("."));
  }

  function updateSegment(id: string, segmentValue: string) {
    updateSegments(
      segments.map((segment) =>
        segment.id === id ? { ...segment, value: segmentValue } : segment,
      ),
    );
  }

  function addSegment() {
    updateSegments([...segments, { id: nextSegmentId(), value: "" }]);
  }

  function removeSegment() {
    if (segments.length <= 1) return;
    updateSegments(segments.slice(0, -1));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {segments.map((segment, index) => (
          <React.Fragment key={segment.id}>
            {index > 0 && (
              <span className="px-0.5 text-sm text-zinc-400">.</span>
            )}
            <Input
              value={segment.value}
              onChange={(event) => updateSegment(segment.id, event.target.value)}
              disabled={disabled}
              className="w-28"
              placeholder={`Part ${index + 1}`}
            />
          </React.Fragment>
        ))}
        <div className="ml-1 flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={removeSegment}
            disabled={disabled || segments.length <= 1}
            aria-label="Remove segment"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addSegment}
            disabled={disabled}
            aria-label="Add segment"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {value && (
        <p className="text-xs text-zinc-500">
          Full name: <span className="font-mono text-zinc-700">{value}</span>
        </p>
      )}
    </div>
  );
}
