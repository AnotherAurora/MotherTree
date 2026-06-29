"use client";

import { useEffect, useState } from "react";
import { ForeignKeyCombobox } from "@/components/admin/foreign-key-combobox";
import { EnumSelect } from "@/components/admin/enum-select";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  COVENANT_OPTIONS,
  WHEEL_OPTIONS,
  type SlotState,
} from "@/components/simulator/mock-data";
import type { ForeignKeyOption } from "@/lib/actions/crud";
import {
  getAwakenerRelatedTags,
  type AwakenerRelatedTags,
} from "@/lib/actions/simulator";

type AwakenerSlotRowProps = {
  index: number;
  slot: SlotState;
  awakenerOptions: ForeignKeyOption[];
  getCachedTags: (awakenerId: number) => AwakenerRelatedTags | undefined;
  setCachedTags: (awakenerId: number, tags: AwakenerRelatedTags) => void;
  onChange: (slot: SlotState) => void;
};

function TagSection({
  title,
  tags,
}: {
  title: string;
  tags: string[];
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
        {title}
      </p>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-400">None</p>
      )}
    </div>
  );
}

export function AwakenerSlotRow({
  index,
  slot,
  awakenerOptions,
  getCachedTags,
  setCachedTags,
  onChange,
}: AwakenerSlotRowProps) {
  const [relatedTags, setRelatedTags] = useState<AwakenerRelatedTags | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slot.awakenerId == null) {
      setRelatedTags(null);
      setLoading(false);
      setError(null);
      return;
    }

    const cached = getCachedTags(slot.awakenerId);
    if (cached) {
      setRelatedTags(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setRelatedTags(null);

    getAwakenerRelatedTags(slot.awakenerId).then((result) => {
      if (cancelled) return;

      if (result.success) {
        setCachedTags(slot.awakenerId!, result.data);
        setRelatedTags(result.data);
        setError(null);
      } else {
        setRelatedTags(null);
        setError(result.error);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [slot.awakenerId, getCachedTags, setCachedTags]);

  return (
    <Card>
      <CardContent className="flex gap-4 p-4">
        <div className="w-48 shrink-0 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-500">
              Awakener {index + 1}
            </Label>
            <ForeignKeyCombobox
              value={slot.awakenerId}
              onChange={(awakenerId) => onChange({ ...slot, awakenerId })}
              options={awakenerOptions}
              placeholder="Select awakener..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-500">Covenant</Label>
            <EnumSelect
              value={slot.covenant}
              onChange={(covenant) => onChange({ ...slot, covenant })}
              options={COVENANT_OPTIONS}
              placeholder="Select covenant..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-500">Wheel</Label>
            <EnumSelect
              value={slot.wheel1}
              onChange={(wheel1) => onChange({ ...slot, wheel1 })}
              options={WHEEL_OPTIONS}
              placeholder="Select wheel..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-500">Wheel</Label>
            <EnumSelect
              value={slot.wheel2}
              onChange={(wheel2) => onChange({ ...slot, wheel2 })}
              options={WHEEL_OPTIONS}
              placeholder="Select wheel..."
            />
          </div>
        </div>

        <div className="flex min-h-[120px] flex-1 flex-col">
          <Label className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Related Tag List
          </Label>
          <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-zinc-50 p-3">
            {slot.awakenerId == null ? (
              <p className="text-sm text-zinc-400">
                Select an awakener to view related tags
              </p>
            ) : loading ? (
              <p className="text-sm text-zinc-400">Loading tags...</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : relatedTags ? (
              <div className="space-y-4">
                <TagSection
                  title="Manifestation Tags"
                  tags={relatedTags.manifestationTags}
                />
                <TagSection
                  title="Override Modifier Tags"
                  tags={relatedTags.overrideTags}
                />
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
