/**
 * In-game team import decode + name resolution smoke test.
 * Run: npm run smoke:ingame-team-import
 */
import { decodeIngameTeamCode } from "../src/lib/team-import/ingame-codec";
import { extractIngameCode } from "../src/lib/team-import/extract-ingame-code";
import { fetchSkeydbLineupCatalogs } from "../src/lib/team-import/fetch-skeydb-lineup-catalogs";
import { buildIngameTokenDictionaries } from "../src/lib/team-import/ingame-token-dictionaries";
import {
  buildMotherTreeNameMaps,
  resolveDecodedTeamToMotherTree,
} from "../src/lib/team-import/resolve-to-mothertree";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

async function main(): Promise<void> {
  console.log("smoke-ingame-team-import");

  const catalogs = await fetchSkeydbLineupCatalogs();
  const dictionaries = buildIngameTokenDictionaries(catalogs);

  {
    const code = "@@laaIaaaaaaaaaaaaX@@";
    const decoded = decodeIngameTeamCode(code, dictionaries);
    assert(decoded.slots[0]?.awakenerId === "awakener-0026", "slot1 awakener-0026");
    assert(decoded.slots[1]?.awakenerId == null, "slot2 empty awakener");
    assert(decoded.slots[3]?.awakenerId === "awakener-0003", "slot4 awakener-0003");
  }

  {
    const extracted = extractIngameCode(
      "Share text before @@laaIaaaaaaaaaaaaX@@ and after",
    );
    assert(extracted === "@@laaIaaaaaaaaaaaaX@@", "extract code from share block");
  }

  {
    const fakeOptionsFromCatalog = {
      awakeners: catalogs.awakeners.records.map((row, index) => ({
        value: index + 1,
        label: row.name,
      })),
      wheels: catalogs.wheels.records.map((row, index) => ({
        value: 1000 + index + 1,
        label: row.name,
      })),
      covenants: catalogs.covenants.records.map((row, index) => ({
        value: 2000 + index + 1,
        label: row.name,
      })),
      posses: catalogs.posses.records.map((row, index) => ({
        value: 3000 + index + 1,
        label: row.name,
      })),
    };
    const nameMaps = buildMotherTreeNameMaps(fakeOptionsFromCatalog);
    const decoded = decodeIngameTeamCode("@@laaIaaaaaaaaaaaaX@@", dictionaries);
    const resolved = resolveDecodedTeamToMotherTree(decoded, catalogs, nameMaps);
    assert(resolved.slots[0]?.awakenerId != null, "resolved slot1 awakener id");
    assert(resolved.slots[3]?.awakenerId != null, "resolved slot4 awakener id");
    assert(
      resolved.slots.every((slot) => slot.covenantStatSetId == null),
      "covenantStatSetId stays null on all slots",
    );
  }

  console.log("\nAll smoke-ingame-team-import checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
