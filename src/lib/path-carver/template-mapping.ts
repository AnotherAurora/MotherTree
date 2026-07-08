import type { TablesInsert } from "@/lib/database.types";
import type { TableRow } from "@/lib/database.types";
import type { SlotState } from "@/lib/simulator/types";
import { createEmptySlots } from "@/lib/simulator/types";

type DesireTemplateRow = TableRow<"desire_template">;

const SLOT_KEYS = [
  {
    awakener: "slot1_awakener_id",
    wheel1: "slot1_wheel1_id",
    wheel2: "slot1_wheel2_id",
    covenant: "slot1_covenant_id",
  },
  {
    awakener: "slot2_awakener_id",
    wheel1: "slot2_wheel1_id",
    wheel2: "slot2_wheel2_id",
    covenant: "slot2_covenant_id",
  },
  {
    awakener: "slot3_awakener_id",
    wheel1: "slot3_wheel1_id",
    wheel2: "slot3_wheel2_id",
    covenant: "slot3_covenant_id",
  },
  {
    awakener: "slot4_awakener_id",
    wheel1: "slot4_wheel1_id",
    wheel2: "slot4_wheel2_id",
    covenant: "slot4_covenant_id",
  },
] as const;

export function templateRowToSlots(row: DesireTemplateRow): {
  slots: SlotState[];
  posseId: number | null;
} {
  const slots = createEmptySlots(4);
  for (let i = 0; i < SLOT_KEYS.length; i++) {
    const keys = SLOT_KEYS[i];
    slots[i] = {
      awakenerId: row[keys.awakener],
      wheel1Id: row[keys.wheel1],
      wheel2Id: row[keys.wheel2],
      covenantId: row[keys.covenant],
    };
  }
  return { slots, posseId: row.posse_id };
}

export function slotsToTemplateRecord(
  desireId: number,
  slots: SlotState[],
  posseId: number,
): TablesInsert<"desire_template"> {
  const record: TablesInsert<"desire_template"> = {
    desire_id: desireId,
    posse_id: posseId,
  };

  for (let i = 0; i < SLOT_KEYS.length; i++) {
    const keys = SLOT_KEYS[i];
    const slot = slots[i] ?? createEmptySlots(1)[0];
    record[keys.awakener] = slot.awakenerId;
    record[keys.wheel1] = slot.wheel1Id;
    record[keys.wheel2] = slot.wheel2Id;
    record[keys.covenant] = slot.covenantId;
  }

  return record;
}
