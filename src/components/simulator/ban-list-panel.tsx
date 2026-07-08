"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ForeignKeyCombobox } from "@/components/admin/foreign-key-combobox";
import { EnumSelect } from "@/components/admin/enum-select";
import type { BanEntry, BanEntityType } from "@/lib/simulator/types";
import type { SimulatorAwakenerOption } from "@/lib/actions/simulator";
import type { SimulatorGearOptions } from "@/lib/actions/simulator-flow";

const ENTITY_TYPE_OPTIONS = [
  "awakener",
  "posse",
  "covenant",
  "wheel",
] as const satisfies readonly BanEntityType[];

type BanListPanelProps = {
  banList: BanEntry[];
  awakenerOptions: SimulatorAwakenerOption[];
  gearOptions: SimulatorGearOptions;
  onAdd: (entry: BanEntry) => void;
  onRemove: (entry: BanEntry) => void;
  onClearAll: () => void;
};

function banEntryKey(entry: BanEntry): string {
  return `${entry.entityType}:${entry.entityId}`;
}

export function BanListPanel({
  banList,
  awakenerOptions,
  gearOptions,
  onAdd,
  onRemove,
  onClearAll,
}: BanListPanelProps) {
  const [adding, setAdding] = useState(false);
  const [entityType, setEntityType] =
    useState<BanEntityType>("awakener");
  const [entityId, setEntityId] = useState<number | null>(null);

  const bannedKeys = useMemo(
    () => new Set(banList.map(banEntryKey)),
    [banList],
  );

  const optionsForType = useMemo(() => {
    switch (entityType) {
      case "awakener":
        return awakenerOptions;
      case "posse":
        return gearOptions.posse;
      case "covenant":
        return gearOptions.covenant;
      case "wheel":
        return gearOptions.wheel;
    }
  }, [entityType, awakenerOptions, gearOptions]);

  const availableOptions = useMemo(
    () =>
      optionsForType.filter(
        (option) => !bannedKeys.has(`${entityType}:${option.value}`),
      ),
    [optionsForType, entityType, bannedKeys],
  );

  function handleAdd() {
    if (entityId == null) return;
    const option = optionsForType.find((o) => o.value === entityId);
    if (!option) return;

    onAdd({
      entityType,
      entityId,
      label: option.label,
    });
    setEntityId(null);
    setAdding(false);
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdding((prev) => !prev)}
        >
          {adding ? "Close" : "Add"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onClearAll}
          disabled={banList.length === 0}
        >
          Clear All
        </Button>
      </div>

      {adding ? (
        <div className="space-y-2 rounded-lg border border-border bg-white p-3">
          <EnumSelect
            value={entityType}
            onChange={(value) => {
              if (value) {
                setEntityType(value as BanEntityType);
                setEntityId(null);
              }
            }}
            options={ENTITY_TYPE_OPTIONS}
            placeholder="Entity type..."
          />
          <ForeignKeyCombobox
            value={entityId}
            onChange={setEntityId}
            options={availableOptions}
            placeholder={`Select ${entityType}...`}
          />
          <Button size="sm" onClick={handleAdd} disabled={entityId == null}>
            Add ban
          </Button>
        </div>
      ) : null}

      <div className="min-h-[120px] overflow-y-auto rounded-lg border border-border bg-zinc-50 p-3">
        {banList.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {banList.map((entry) => (
              <button
                key={banEntryKey(entry)}
                type="button"
                onClick={() => onRemove(entry)}
                className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700 transition-colors hover:bg-red-100"
                title="Click to remove"
              >
                {entry.entityType} · {entry.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No banned entities</p>
        )}
      </div>
    </div>
  );
}
