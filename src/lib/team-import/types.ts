import type { SlotState } from "@/lib/simulator/types";

export type IngameImportWarning = {
  section: "awakener" | "wheel" | "covenant" | "posse";
  slotIndex?: number;
  field?: "wheelOne" | "wheelTwo";
  token: string;
  reason: "unknown_token" | "ambiguous_parse" | "unresolved_name";
  candidateIds?: string[];
  skeydbId?: string;
};

/** Decoded team with SKeyDB string IDs before MotherTree resolution. */
export type DecodedIngameSlot = {
  awakenerId: string | null;
  wheel1Id: string | null;
  wheel2Id: string | null;
  covenantId: string | null;
};

export type DecodedIngameTeam = {
  slots: DecodedIngameSlot[];
  posseId: string | null;
  warnings: IngameImportWarning[];
};

export type ImportTeamResult = {
  slots: SlotState[];
  posseId: number | null;
  warnings: IngameImportWarning[];
};

export type SkeydbLineupCatalogRecord = {
  id: string;
  name: string;
  lineupToken?: string;
};

export type SkeydbLineupCatalogFile = {
  records: SkeydbLineupCatalogRecord[];
};

export type SkeydbLineupCatalogs = {
  awakeners: SkeydbLineupCatalogFile;
  wheels: SkeydbLineupCatalogFile;
  covenants: SkeydbLineupCatalogFile;
  posses: SkeydbLineupCatalogFile;
};
