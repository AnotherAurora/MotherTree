import {
  assertIngameCodeLength,
  extractIngameCode,
} from "./extract-ingame-code";
import { fetchSkeydbLineupCatalogs } from "./fetch-skeydb-lineup-catalogs";
import { decodeIngameTeamCode } from "./ingame-codec";
import { buildIngameTokenDictionaries } from "./ingame-token-dictionaries";
import {
  buildMotherTreeNameMaps,
  resolveDecodedTeamToMotherTree,
  type MotherTreeNameMaps,
} from "./resolve-to-mothertree";
import type { ImportTeamResult } from "./types";

export type { ImportTeamResult, IngameImportWarning } from "./types";
export { extractIngameCode, assertIngameCodeLength } from "./extract-ingame-code";
export {
  buildMotherTreeNameMaps,
  formatIngameImportWarningMessage,
} from "./resolve-to-mothertree";

export async function importIngameTeamFromCode(
  rawCode: string,
  nameMaps: MotherTreeNameMaps,
): Promise<ImportTeamResult> {
  const wrapped = extractIngameCode(rawCode);
  if (!wrapped) {
    throw new Error("Import code is empty.");
  }
  assertIngameCodeLength(wrapped);

  const catalogs = await fetchSkeydbLineupCatalogs();
  const dictionaries = buildIngameTokenDictionaries(catalogs);
  const decoded = decodeIngameTeamCode(wrapped, dictionaries);
  return resolveDecodedTeamToMotherTree(decoded, catalogs, nameMaps);
}
